"""Compare retained NWDP station coordinates with supplied SOI village polygons.

This is an evidence-generation tool only. It does not set trusted mapping flags:
the NWDP CSV does not document the CRS/datum of its Latitude/Longitude columns,
and SOI's supplied polygons are village features (with block attributes), not
independently published development-block polygons. All results are candidates
until those assumptions and the canonical crosswalk are reviewed.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import argparse
import zipfile
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOUNDARY_DIR = ROOT / "GEOJSON FILES"
STATIONS_PATH = ROOT / "data/derived/nwdp_telemetry_normalized.json"
CROSSWALK_PATH = ROOT / "audit/canonical_43_lgd_crosswalk.json"
OUTPUT_PATH = ROOT / "data/derived/nwdp_soi_station_containment_candidates.json"

STATE_ZIP = {
    "Haryana": "hr", "Karnataka": "ka", "Meghalaya": "ml",
    "Madhya Pradesh": "mp", "Punjab": "pb", "Rajasthan": "rj",
    "Tamil Nadu": "tn", "Tripura": "tr", "Telangana": "ts",
}
CRS = "urn:ogc:def:crs:EPSG::7755"


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for part in iter(lambda: f.read(1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def norm(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").strip().lower())


def wgs84_to_epsg7755(lon: float, lat: float) -> tuple[float, float]:
    """EPSG:7755 WGS84 / India NSF LCC forward projection (metres)."""
    a, inv_f = 6378137.0, 298.257223563
    f = 1.0 / inv_f
    e = math.sqrt(2 * f - f * f)
    phi1, phi2 = math.radians(12.472955), math.radians(35.1728044444444)
    phi0, lam0 = math.radians(24.0), math.radians(80.0)

    def m(phi: float) -> float:
        return math.cos(phi) / math.sqrt(1 - e * e * math.sin(phi) ** 2)

    def t(phi: float) -> float:
        sinp = math.sin(phi)
        return math.tan(math.pi / 4 - phi / 2) / ((1 - e * sinp) / (1 + e * sinp)) ** (e / 2)

    n = math.log(m(phi1) / m(phi2)) / math.log(t(phi1) / t(phi2))
    big_f = m(phi1) / (n * t(phi1) ** n)
    rho = a * big_f * t(math.radians(lat)) ** n
    rho0 = a * big_f * t(phi0) ** n
    theta = n * (math.radians(lon) - lam0)
    return 4_000_000 + rho * math.sin(theta), 4_000_000 + rho0 - rho * math.cos(theta)


def on_segment(x: float, y: float, a: list, b: list, eps: float = 1e-5) -> bool:
    cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0])
    if abs(cross) > eps * max(1.0, math.hypot(b[0] - a[0], b[1] - a[1])):
        return False
    return min(a[0], b[0]) - eps <= x <= max(a[0], b[0]) + eps and min(a[1], b[1]) - eps <= y <= max(a[1], b[1]) + eps


def ring_contains(x: float, y: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i, point in enumerate(ring):
        prev = ring[j]
        if on_segment(x, y, prev, point):
            return True
        if (point[1] > y) != (prev[1] > y):
            crossing_x = (prev[0] - point[0]) * (y - point[1]) / (prev[1] - point[1]) + point[0]
            if x < crossing_x:
                inside = not inside
        j = i
    return inside


def polygon_contains(x: float, y: float, polygon: list) -> bool:
    if not polygon or not ring_contains(x, y, polygon[0]):
        return False
    return not any(ring_contains(x, y, hole) for hole in polygon[1:])


def geometry_contains(x: float, y: float, geometry: dict) -> bool:
    kind, coords = geometry.get("type"), geometry.get("coordinates", [])
    polygons = [coords] if kind == "Polygon" else coords if kind == "MultiPolygon" else []
    return any(polygon_contains(x, y, polygon) for polygon in polygons)


def feature_lines(stream):
    # The supplied GeoJSON is pretty-printed at collection level, with one
    # complete Feature JSON object per physical line after "features".
    in_features = False
    for raw in stream:
        line = raw.decode("utf-8").strip()
        if not in_features:
            if line.startswith('"features"'):
                in_features = True
            continue
        if line.startswith("]"):
            break
        if line.startswith("{\"type\": \"Feature\"") or line.startswith('{ "type": "Feature"'):
            yield json.loads(line.rstrip(","))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--states", nargs="*", choices=["HR", "KA", "ML", "MP", "PB", "RJ", "TN", "TR", "TS"],
                        help="Optional state slugs to inspect; defaults to all nine active states.")
    args = parser.parse_args()
    selected = {value.lower() for value in args.states} if args.states else set(STATE_ZIP.values())
    state_by_suffix = {suffix: state for state, suffix in STATE_ZIP.items()}
    work_states = [(state_by_suffix[suffix], suffix) for suffix in STATE_ZIP.values() if suffix in selected]
    stations_doc = json.loads(STATIONS_PATH.read_text(encoding="utf-8"))
    stations = stations_doc["stations"]
    crosswalk = json.loads(CROSSWALK_PATH.read_text(encoding="utf-8"))
    by_state: dict[str, list[dict]] = defaultdict(list)
    for station in stations:
        if station.get("state") in STATE_ZIP and STATE_ZIP[station["state"]] in selected:
            try:
                lon = float(station["longitude_source"])
                lat = float(station["latitude_source"])
            except (KeyError, TypeError, ValueError):
                continue
            if -180 <= lon <= 180 and -90 <= lat <= 90:
                x, y = wgs84_to_epsg7755(lon, lat)
                by_state[station["state"]].append({**station, "_x": x, "_y": y, "_hits": []})

    boundaries = []
    for state, suffix in work_states:
        path = BOUNDARY_DIR / f"vb_soi_{suffix}_geojson.zip"
        if not path.is_file():
            raise FileNotFoundError(path)
        state_stations = by_state[state]
        features = Counter()
        member_name = None
        with zipfile.ZipFile(path) as archive:
            geojson_members = [n for n in archive.namelist() if n.lower().endswith((".geojson", ".json"))]
            if len(geojson_members) != 1:
                raise ValueError(f"Expected one GeoJSON member in {path.name}, got {geojson_members}")
            member_name = geojson_members[0]
            with archive.open(member_name) as source:
                for feature in feature_lines(source):
                    props = feature.get("properties") or {}
                    geom = feature.get("geometry") or {}
                    features["total"] += 1
                    features["soi_agency"] += props.get("src_agency") == "Survey of India (SOI)"
                    features["with_block_label"] += bool(norm(props.get("block")))
                    polygons = ([geom.get("coordinates", [])] if geom.get("type") == "Polygon" else geom.get("coordinates", []))
                    polygon_bounds = []
                    for polygon in polygons:
                        rings = [polygon] if geom.get("type") == "Polygon" else polygon
                        if not rings or not rings[0]:
                            continue
                        outer = rings[0]
                        polygon_bounds.append((rings, min(p[0] for p in outer), max(p[0] for p in outer),
                                               min(p[1] for p in outer), max(p[1] for p in outer)))
                    for point in state_stations:
                        if point["_hits"] and len(point["_hits"]) > 1:
                            continue
                        x, y = point["_x"], point["_y"]
                        # Cheap polygon bbox rejection before ring checks.
                        for rings, min_x, max_x, min_y, max_y in polygon_bounds:
                            if min_x <= x <= max_x and min_y <= y <= max_y:
                                if polygon_contains(x, y, rings):
                                    point["_hits"].append({
                                        "village_id": str(props.get("vlcode", "")),
                                        "village_name": props.get("village"),
                                        "soi_block_code": str(props.get("bkcode", "")),
                                        "soi_block_name": props.get("block"),
                                        "district": props.get("district"),
                                        "state_code": props.get("stcode"),
                                        "source_agency": props.get("src_agency"),
                                    })
                                    break
            print(f"Scanned {state}: {features['total']:,} village features; {len(state_stations):,} source stations", flush=True)
        boundaries.append({
            "state": state,
            "archive": path.relative_to(ROOT).as_posix(),
            "archive_sha256": digest(path),
            "archive_bytes": path.stat().st_size,
            "geojson_member": member_name,
            "crs": CRS,
            "feature_counts": dict(features),
            "metadata_version": "not present in archive; SOI catalog references Version01 harmonization with ORGI",
            "evidence_status": "candidate_boundary_source; archive metadata reviewed 2026-10-25",
        })

    crosswalk_by_state = defaultdict(list)
    for item in crosswalk:
        crosswalk_by_state[item["state"]].append(item)
    result_stations = []
    summary = Counter()
    for state, points in by_state.items():
        for station in points:
            hit_blocks = []
            for hit in station["_hits"]:
                exact = [c for c in crosswalk_by_state[state]
                         if norm(c.get("lgd_block_name")) == norm(hit.get("soi_block_name"))
                         and norm(c.get("lgd_district_name")) == norm(hit.get("district"))]
                hit_blocks.append({**hit, "canonical_candidates": [
                    {"block_id": c["canonical_id"], "lgd_block_code": c["lgd_block_code"]} for c in exact
                ]})
            if len(hit_blocks) == 1 and len(hit_blocks[0]["canonical_candidates"]) == 1:
                status = "spatial_candidate_exact_name_crosswalk_coordinate_crs_unverified"
            elif len(hit_blocks) > 1:
                status = "ambiguous_multiple_polygon_hits"
            elif len(hit_blocks) == 1:
                status = "spatial_candidate_no_unique_canonical_crosswalk"
            else:
                status = "no_polygon_containment_candidate"
            summary[status] += 1
            result_stations.append({
                "station_key": station["station_key"],
                "station_name": station["source_station_name"],
                "state": state,
                "district_source": station["district"],
                "latitude_source": station["latitude_source"],
                "longitude_source": station["longitude_source"],
                "coordinate_interpretation": "Decimal latitude/longitude values transformed as EPSG:4326; source datum/CRS is undocumented and this is not verified.",
                "boundary_hits": hit_blocks,
                "mapping_status": status,
                "verified": False,
                "operational_eligibility": False,
            })

    output = {
        "generated_at": date.today().isoformat(),
        "purpose": "Non-authoritative spatial candidate audit; does not alter trusted mapping registry or readiness.",
        "algorithm": "EPSG:4326-to-EPSG:7755 WGS84 LCC transform followed by point-in-village-polygon containment.",
        "limitations": [
            "NWDP station coordinate CRS/datum is not documented in the retained source metadata.",
            "Supplied SOI data is village-level geometry carrying block/district labels, not an independent block polygon layer.",
            "Canonical crosswalk comparison uses exact normalized block and district labels; the SOI bkcode is not an LGD block code.",
            "No station-specific measurement datum, installation-depth, calibration, or sign-convention evidence is supplied by this spatial check.",
        ],
        "boundary_archives": boundaries,
        "states_included": [state for state, _ in work_states],
        "candidate_station_count": len(result_stations),
        "candidate_counts": dict(summary),
        "stations": result_stations,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": OUTPUT_PATH.relative_to(ROOT).as_posix(), "stations": len(result_stations),
                      "candidate_counts": dict(summary), "priority": [
                          {"station": s["station_name"], "state": s["state"], "mapping_status": s["mapping_status"],
                           "hits": s["boundary_hits"]}
                          for s in result_stations if s["station_name"] in {"ChocftraPz", "Bapi_Pz_1", "TIGARIA_1", "UTHANDI_1"}
                      ]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
