"""
LEGACY / DISABLED ENTRY POINT. Use scripts/rebuild_nwdp_authoritative.py for the
18-file NWDP-only, record-lineage pipeline. This former ingestor mixed regional
and NWDP sources and could overwrite authoritative derived artifact paths.

JAL DRISHTI — Official NWDP/NWIC Telemetry Ingestion, Validation & Normalization Engine
=======================================================================================
Processes the 10 official NWDP groundwater telemetry datasets for the 10 target states:
Karnataka, Telangana, Tamil Nadu, Madhya Pradesh, Rajasthan, Punjab, Haryana, Meghalaya, Assam, Tripura.

Enforces Scientific Integrity & Validation Rules:
1. Standardized 21-column NWDP CKAN schema normalization.
2. Physical depth validation: 0.0 <= depth <= 150.0 m bgl.
3. Explicit Quarantine Rules:
   - Negative values with undocumented convention/datum -> quarantine without conversion
   - Sentinel-like values -> unverified candidates pending station-specific QC
   - Physically implausible (>150.0 m bgl) -> 'physically_implausible_depth'
   - Non-numeric or missing -> 'invalid_or_missing_depth'
4. Station Identity Separation (Tamil Nadu):
   - Isolates 'Tamil Nadu::Coimbatore::P.N.Palayam' (shallow well) from 'Tamil Nadu::Coimbatore::Kalviramapalayam' (deep fractured-rock piezometer).
5. Deterministic deduplication and chronological ordering.
6. Generates validated normalized telemetry, quarantine ledger, and ingestion manifest.
"""

import csv
import json
import math
import os
import re
import ssl
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

REGISTRY_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'sources', 'nwdp_telemetry_registry.json')
READINESS_PATH = os.path.join(os.path.dirname(__file__), '..', 'audit', 'global_model_block_readiness.json')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'derived')

# Canonical State Name Normalization
CANONICAL_STATES = {
    'karnataka': 'Karnataka',
    'ka': 'Karnataka',
    'telangana': 'Telangana',
    'ts': 'Telangana',
    'tamil nadu': 'Tamil Nadu',
    'tamil_nadu': 'Tamil Nadu',
    'tn': 'Tamil Nadu',
    'madhya pradesh': 'Madhya Pradesh',
    'madhya_pradesh': 'Madhya Pradesh',
    'mp': 'Madhya Pradesh',
    'rajasthan': 'Rajasthan',
    'rj': 'Rajasthan',
    'punjab': 'Punjab',
    'pb': 'Punjab',
    'haryana': 'Haryana',
    'hr': 'Haryana',
    'meghalaya': 'Meghalaya',
    'ml': 'Meghalaya',
    'tripura': 'Tripura',
    'tr': 'Tripura',
}

def parse_nwdp_timestamp(date_str: str) -> Optional[str]:
    """Parses various date/time formats from NWDP datasets into ISO 8601 YYYY-MM-DDTHH:MM:SS."""
    if not date_str or not date_str.strip():
        return None
    cleaned = date_str.strip()
    formats = [
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d-%m-%Y",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return None

def normalize_station_id(state: str, district: str, station_name: str) -> str:
    """Constructs a deterministic canonical station key."""
    st = CANONICAL_STATES.get(state.lower().strip(), state.strip())
    dist = district.strip().title() if district and district.strip() != '-' else 'Unknown'
    stn = station_name.strip()
    return f"{st}::{dist}::{stn}"

class NWDPTelemetryIngestor:
    def __init__(self):
        self.raw_records_scanned = 0
        self.valid_records_count = 0
        self.unverified_candidate_count = 0
        self.unverified_candidates: List[Dict[str, Any]] = []
        self.quarantined_count = 0
        self.quarantine_by_reason: Dict[str, int] = {}
        self.quarantine_ledger: List[Dict[str, Any]] = []
        self.validated_observations: Dict[str, List[Dict[str, Any]]] = {} # keyed by canonical station_id
        self.station_metadata: Dict[str, Dict[str, Any]] = {}
        self.canonical_blocks = self._load_canonical_blocks()

    def _load_canonical_blocks(self) -> Dict[str, Dict[str, Any]]:
        with open(READINESS_PATH, 'r', encoding='utf-8') as f:
            ledger = json.load(f)
        blocks = {}
        for b in ledger.get('blocks', []):
            blocks[b['block_id']] = b
        return blocks

    def record_quarantine(self, state: str, station: str, timestamp: Optional[str], raw_val: Any, reason: str, details: Optional[Dict[str, Any]] = None):
        self.quarantined_count += 1
        self.quarantine_by_reason[reason] = self.quarantine_by_reason.get(reason, 0) + 1
        if len(self.quarantine_ledger) < 1000: # Bound in-memory sample ledger
            entry = {
                'state': state,
                'station': station,
                'timestamp': timestamp,
                'raw_value': raw_val,
                'quarantine_reason': reason,
            }
            if details:
                entry['details'] = details
            self.quarantine_ledger.append(entry)

    def validate_and_record_observation(self, state: str, district: str, block: str, station_name: str,
                                         lat_str: str, lon_str: str, rsl_str: str,
                                         time_str: str, val_str: str, agency: str, source_file: str):
        self.raw_records_scanned += 1
        canonical_state = CANONICAL_STATES.get(state.lower().strip(), state.strip())
        station_id = normalize_station_id(canonical_state, district, station_name)

        # 1. Timestamp validation
        parsed_time = parse_nwdp_timestamp(time_str)
        if not parsed_time:
            self.record_quarantine(canonical_state, station_id, time_str, val_str, 'invalid_timestamp_format')
            return

        # 2. Value validation and Quarantine Rules
        if not val_str or not val_str.strip() or val_str.strip() == '-':
            self.record_quarantine(canonical_state, station_id, parsed_time, val_str, 'missing_depth_value')
            return

        try:
            depth_val = float(val_str.strip())
        except (ValueError, TypeError):
            self.record_quarantine(canonical_state, station_id, parsed_time, val_str, 'non_numeric_depth_reading')
            return

        if not math.isfinite(depth_val):
            self.record_quarantine(canonical_state, station_id, parsed_time, val_str, 'non_finite_depth_reading')
            return

        # Negative reading quarantine: measurement convention and datum are unverified.
        if depth_val < 0.0:
            self.record_quarantine(canonical_state, station_id, parsed_time, depth_val,
                                   'negative_reading_unverified_sign_and_datum',
                                   {'note': 'Meaning, sign convention, station datum, and calibration are undocumented; value is not converted'})
            return

        # Sentinel-like patterns are not globally invalid without station-specific
        # source or instrument evidence; retain as unverified candidates.
        if depth_val in (99.0, 999.0, 99.99, 999.99):
            self.unverified_candidates.append({
                'station_id': station_id,
                'timestamp': parsed_time,
                'original_measurement': depth_val,
                'source_file': source_file,
                'quality_status': 'sentinel_pattern_pending_station_qc',
            })
            self.unverified_candidate_count += 1
            return

        # Physical implausibility boundary (> 150.0 m bgl)
        if depth_val > 150.0:
            self.record_quarantine(canonical_state, station_id, parsed_time, depth_val,
                                   'physically_implausible_depth',
                                   {'note': 'Value exceeds maximum physical aquifer depth threshold of 150.0 m bgl'})
            return

        # A numeric nonnegative value is not a verified m bgl observation.
        # Keep it as an unverified candidate; this legacy code has no station-
        # specific datum/calibration or block-containment evidence.
        self.unverified_candidates.append({
            'station_id': station_id,
            'timestamp': parsed_time,
            'original_measurement': depth_val,
            'source_file': source_file,
            'quality_status': 'unverified_measurement_semantics_and_station_mapping',
        })
        self.unverified_candidate_count += 1
        return

        # 3. Tamil Nadu Special Aquifer Identity Separation Rule
        # Never merge P.N.Palayam shallow dug well with Kalviramapalayam deep fractured-rock piezometer
        if canonical_state == 'Tamil Nadu':
            lower_station = station_name.lower()
            if 'p.n.palayam' in lower_station or 'pn palayam' in lower_station:
                aquifer_type = 'shallow_unconfined_alluvium'
            elif 'kalviramapalayam' in lower_station:
                aquifer_type = 'deep_fractured_crystalline_rock'
            else:
                aquifer_type = 'standard_piezometer'
        else:
            aquifer_type = 'standard_telemetry_station'

        # Parse coordinates
        lat, lon = None, None
        try:
            if lat_str and lat_str.strip() and lat_str.strip() != '-':
                lat = float(lat_str.strip())
            if lon_str and lon_str.strip() and lon_str.strip() != '-':
                lon = float(lon_str.strip())
        except ValueError:
            pass

        # Parse RL (Reduced Level)
        rl_msl = None
        try:
            if rsl_str and rsl_str.strip() and rsl_str.strip() != '-':
                rl_msl = float(rsl_str.strip())
        except ValueError:
            pass

        # Update metadata if not recorded
        if station_id not in self.station_metadata:
            self.station_metadata[station_id] = {
                'station_id': station_id,
                'station_name': station_name,
                'state': canonical_state,
                'district': district.strip().title() if district else None,
                'block': block.strip().title() if block and block.strip() != '-' else None,
                'latitude': lat,
                'longitude': lon,
                'rl_msl_m': rl_msl,
                'agency': agency,
                'aquifer_type': aquifer_type,
                'source_file': source_file,
            }

        if station_id not in self.validated_observations:
            self.validated_observations[station_id] = []

        self.validated_observations[station_id].append({
            'stationId': station_id,
            'timestamp': parsed_time,
            'observationDate': parsed_time.split(' ')[0],
            'depthMbgl': round(depth_val, 3),
            'units': 'm bgl',
            'aquifer_type': aquifer_type
        })
        self.valid_records_count += 1

    def ingest_csv_file(self, file_path: str, state_hint: str):
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return

        print(f"Ingesting [{state_hint}] from {os.path.basename(file_path)}...")
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if not header:
                return

            # Map header columns
            h_lower = [c.strip().lower() for c in header]
            col_map = {}
            for idx, col in enumerate(h_lower):
                if 'station' in col:
                    if 'code' not in col or 'station' not in col_map:
                        col_map['station'] = idx
                elif 'state' in col and 'code' not in col and 'lgd' not in col:
                    col_map['state'] = idx
                elif 'district' in col and 'code' not in col and 'lgd' not in col:
                    col_map['district'] = idx
                elif 'block' in col and 'code' not in col:
                    col_map['block'] = idx
                elif 'latitude' in col or col == 'lat':
                    col_map['lat'] = idx
                elif 'longitude' in col or col == 'lon':
                    col_map['lon'] = idx
                elif 'rl_msl' in col or 'elevation' in col:
                    col_map['rl_msl'] = idx
                elif 'acquisition time' in col or 'date' in col or col == 'time':
                    col_map['time'] = idx
                elif 'telemetry' in col or 'water level' in col or 'depth' in col:
                    col_map['depth'] = idx
                elif 'agency' in col:
                    col_map['agency'] = idx

            for row in reader:
                if not row or len(row) <= 5:
                    continue
                stn = row[col_map['station']] if 'station' in col_map and col_map['station'] < len(row) else ''
                st = row[col_map['state']] if 'state' in col_map and col_map['state'] < len(row) else state_hint
                dist = row[col_map['district']] if 'district' in col_map and col_map['district'] < len(row) else ''
                blk = row[col_map['block']] if 'block' in col_map and col_map['block'] < len(row) else ''
                lat = row[col_map['lat']] if 'lat' in col_map and col_map['lat'] < len(row) else ''
                lon = row[col_map['lon']] if 'lon' in col_map and col_map['lon'] < len(row) else ''
                rl = row[col_map['rl_msl']] if 'rl_msl' in col_map and col_map['rl_msl'] < len(row) else ''
                t_val = row[col_map['time']] if 'time' in col_map and col_map['time'] < len(row) else ''
                d_val = row[col_map['depth']] if 'depth' in col_map and col_map['depth'] < len(row) else ''
                ag = row[col_map['agency']] if 'agency' in col_map and col_map['agency'] < len(row) else 'NWDP/CGWB'

                self.validate_and_record_observation(st, dist, blk, stn, lat, lon, rl, t_val, d_val, ag, os.path.basename(file_path))

    def run_all_sources(self):
        raise RuntimeError(
            "Retired mixed-source ingestion path. Use scripts/rebuild_nwdp_authoritative.py; "
            "the retained 18-file NWDP registry is the sole active telemetry input."
        )

        source_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'sources')
        raw_telemetry_dir = os.path.join(source_dir, 'nwdp_telemetry_raw')
        regional_dir = os.path.join(source_dir, 'cgwb_regional')
        contrast_dir = os.path.join(source_dir, 'cgwb_contrast')

        # Ingest both the historical CGWB quarterly ledgers and the newly persisted NWDP telemetry CSVs
        files_to_ingest = [
            # 1. Karnataka
            (os.path.join(regional_dir, 'KA_2021_2025.csv'), 'Karnataka'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_ka_2021_2025.csv'), 'Karnataka'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_ka_2026_2030.csv'), 'Karnataka'),
            # 2. Telangana
            (os.path.join(regional_dir, 'TS_2021_2025.csv'), 'Telangana'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_ts_2021_2025.csv'), 'Telangana'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_ts_2026_2030.csv'), 'Telangana'),
            # 3. Tamil Nadu
            (os.path.join(regional_dir, 'TN_2021_2025.csv'), 'Tamil Nadu'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_tn_2021_2025.csv'), 'Tamil Nadu'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_tn_2026_2030.csv'), 'Tamil Nadu'),
            # 4. Madhya Pradesh
            (os.path.join(source_dir, 'cgwb_mp_cleaned_proper.csv'), 'Madhya Pradesh'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_mp_2021_2025.csv'), 'Madhya Pradesh'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_mp_2026_2030.csv'), 'Madhya Pradesh'),
            # 5. Rajasthan
            (os.path.join(contrast_dir, 'RJ.csv'), 'Rajasthan'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_rj_2021_2025.csv'), 'Rajasthan'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_rj_2026_2030.csv'), 'Rajasthan'),
            # 6. Punjab
            (os.path.join(contrast_dir, 'PB.csv'), 'Punjab'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_pb_2021_2025.csv'), 'Punjab'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_pb_2026_2030.csv'), 'Punjab'),
            # 7. Haryana
            (os.path.join(contrast_dir, 'HR.csv'), 'Haryana'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_hr_2021_2025.csv'), 'Haryana'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_hr_2026_2030.csv'), 'Haryana'),
            # 8. Meghalaya
            (os.path.join(regional_dir, 'ML_2021_2025.csv'), 'Meghalaya'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_ml_2021_2025.csv'), 'Meghalaya'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_ml_2026_2030.csv'), 'Meghalaya'),
            # 9. Tripura
            (os.path.join(regional_dir, 'TR_2021_2025.csv'), 'Tripura'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_tr_2021_2025.csv'), 'Tripura'),
            (os.path.join(raw_telemetry_dir, 'gwl_tel_6_hourly_cgwb_tr_2026_2030.csv'), 'Tripura'),
        ]

        for path, state in files_to_ingest:
            if os.path.exists(path):
                self.ingest_csv_file(path, state)

        # Deduplicate and sort chronologically for each station
        print("\nApplying deterministic deduplication and chronological ordering...")
        final_stations = {}
        for stn_id, obs_list in self.validated_observations.items():
            # Deduplicate by (observationDate, timestamp)
            seen_times = set()
            clean_list = []
            for obs in sorted(obs_list, key=lambda x: x['timestamp']):
                t = obs['timestamp']
                if t not in seen_times:
                    seen_times.add(t)
                    clean_list.append(obs)
            if clean_list:
                final_stations[stn_id] = {
                    'metadata': self.station_metadata.get(stn_id, {}),
                    'total_observations': len(clean_list),
                    'earliest_observation': clean_list[0]['timestamp'],
                    'latest_observation': clean_list[-1]['timestamp'],
                    'observations': clean_list
                }

        # Save Normalized Telemetry
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        norm_output_path = os.path.join(OUTPUT_DIR, 'nwdp_telemetry_normalized.json')
        with open(norm_output_path, 'w', encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'generated_at': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'states_covered': list(set(CANONICAL_STATES.values())),
                    'total_stations': len(final_stations),
                    'total_validated_observations': self.valid_records_count,
                    'total_quarantined_records': self.quarantined_count
                },
                'stations': final_stations
            }, f, indent=2)
        print(f"Saved normalized telemetry to {norm_output_path}")

        # Save Quarantine Ledger
        quarantine_path = os.path.join(OUTPUT_DIR, 'nwdp_telemetry_quarantine.json')
        with open(quarantine_path, 'w', encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'generated_at': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'total_quarantined': self.quarantined_count,
                    'reasons_summary': self.quarantine_by_reason,
                },
                'sample_quarantine_records': self.quarantine_ledger
            }, f, indent=2)
        print(f"Saved quarantine audit ledger to {quarantine_path}")

        # Save Ingestion Manifest
        manifest_path = os.path.join(OUTPUT_DIR, 'nwdp_telemetry_ingestion_manifest.json')
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump({
                'generated_at': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ'),
                'raw_records_scanned': self.raw_records_scanned,
                'valid_records_count': self.valid_records_count,
                'quarantined_count': self.quarantined_count,
                'quarantine_breakdown': self.quarantine_by_reason,
                'stations_by_state': self._count_stations_by_state(final_stations),
                'status': 'success'
            }, f, indent=2)
        print(f"Saved ingestion manifest to {manifest_path}")

        print("\n=== INGESTION SUMMARY ===")
        print(f"Total Raw Records Scanned: {self.raw_records_scanned:,}")
        print(f"Total Valid Observations:  {self.valid_records_count:,}")
        print(f"Total Quarantined Records: {self.quarantined_count:,}")
        print("Quarantine Breakdown by Reason:")
        for reason, count in sorted(self.quarantine_by_reason.items(), key=lambda x: -x[1]):
            print(f"  - {reason}: {count:,}")

    def _count_stations_by_state(self, stations: Dict[str, Any]) -> Dict[str, int]:
        counts = {}
        for s_id, s_data in stations.items():
            st = s_data['metadata'].get('state', 'Unknown')
            counts[st] = counts.get(st, 0) + 1
        return counts

if __name__ == '__main__':
    raise SystemExit(
        "Deprecated mixed-source ingestor is disabled; it must not overwrite current NWDP artifacts. "
        "Run scripts/rebuild_nwdp_authoritative.py instead."
    )
