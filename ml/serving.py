"""Private HTTP boundary for GlobalBlockAwareQuantileGB-v1.

Run only behind private networking.  This process is not a public API and
never accepts browser credentials or claims an observation is official; the
Next.js server is responsible for resolving trusted records before calling it.
"""
import hmac
import json
import math
import os
import sys
from datetime import date
from functools import lru_cache
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from ml.inference import forecast_from_observation_series, load_global_model_artifact, resolve_global_geographic_context
from ml.nwdp_inference import forecast_station, load_station_model

MAX_BODY_BYTES = 64 * 1024
EXPECTED_MODEL = "GlobalBlockAwareQuantileGB-v1"


@lru_cache(maxsize=1)
def model():
    return load_global_model_artifact()


@lru_cache(maxsize=1)
def station_model():
    return load_station_model()


def unavailable(reason):
    return {"status": "unavailable", "reason": reason, "operationalEligibility": False,
            "intervalStatus": "ordered_uncalibrated"}


def validate_request(payload):
    if not isinstance(payload, dict) or payload.get("contractVersion") != "global-forecast/v1":
        raise ValueError("invalid_contract")
    geography = payload.get("geography")
    source = payload.get("trustedObservationSource")
    observations = payload.get("observations")
    if not isinstance(geography, dict) or not all(isinstance(geography.get(k), str) and geography[k].strip() for k in ("state", "district", "block", "blockId")):
        raise ValueError("invalid_geography")
    if source != "internal_verified_block_observations":
        raise ValueError("untrusted_observation_source")
    if not isinstance(observations, list) or not 2 <= len(observations) <= 256:
        raise ValueError("invalid_observations")
    station_ids = {str(item.get("stationId", "")).strip() for item in observations if str(item.get("stationId", "")).strip()}
    if len(station_ids) != 1:
        raise ValueError("ambiguous_or_missing_station")
    primary_station = next(iter(station_ids))
    for item in observations:
        depth = item.get("depthMbgl")
        try:
            valid_date = isinstance(item.get("observationDate"), str) and date.fromisoformat(item["observationDate"])
        except ValueError:
            valid_date = False
        if (item.get("units") != "m bgl" or not valid_date
                or isinstance(depth, bool) or not isinstance(depth, (int, float))
                or not math.isfinite(depth)):
            raise ValueError("invalid_observation_schema")
    return geography, observations, primary_station


def infer(payload):
    geography, records, station = validate_request(payload)
    resolve_global_geographic_context(model(), geography["state"], geography["district"], geography["block"])
    observations = [{"date": r["observationDate"], "depth_mbgl": r.get("depthMbgl")} for r in records]
    result = forecast_from_observation_series(
        observations, geography["state"], geography["blockId"], geography["block"],
        geography["district"], station_name=station, num_horizons=4,
    )
    if result.get("modelStatus") != "research_prototype" or not result.get("forecasts"):
        return unavailable("inference_unavailable")
    return {
        "status": "research_prototype", "modelIdentifier": EXPECTED_MODEL,
        "modelVersion": "1.0.0", "geography": geography,
        "originObservationDate": result["latestObservationDate"], "units": "m bgl",
        "intervalStatus": "ordered_uncalibrated", "operationalEligibility": False,
        "forecast": result,
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return  # Do not log payloads or authentication material.

    def reply(self, status, body):
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self):
        token = os.environ.get("JALDRISHTI_MODEL_SERVICE_TOKEN", "")
        if self.path not in ("/v1/forecast", "/v1/station-forecast") or not token or not hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {token}"):
            self.reply(HTTPStatus.UNAUTHORIZED, unavailable("unauthorized")); return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError("invalid_request_size")
            body = json.loads(self.rfile.read(length))
            if self.path == "/v1/station-forecast":
                h_days = body.get("horizonDays", 7)
                if not isinstance(body, dict) or h_days not in (7, 90, 180) or not isinstance(body.get("stationId"), str):
                    raise ValueError("invalid_station_forecast_request")
                self.reply(HTTPStatus.OK, forecast_station(body["stationId"], station_model(), horizon_days=h_days))
            else:
                self.reply(HTTPStatus.OK, infer(body))
        except KeyError as err:
            sys.stderr.write(f"[serving] KeyError: {err}\n")
            self.reply(HTTPStatus.NOT_FOUND, {"status": "unavailable", "reason": "station_not_trained", "operationalEligibility": False})
        except (ValueError, TypeError) as err:
            sys.stderr.write(f"[serving] Request error: {type(err).__name__}: {err}\n")
            self.reply(HTTPStatus.BAD_REQUEST, unavailable("invalid_request"))
        except FileNotFoundError as err:
            sys.stderr.write(f"[serving] FileNotFoundError: {err}\n")
            self.reply(HTTPStatus.SERVICE_UNAVAILABLE, unavailable("model_artifact_unavailable"))
        except Exception as err:
            sys.stderr.write(f"[serving] Unexpected exception: {type(err).__name__}: {err}\n")
            self.reply(HTTPStatus.SERVICE_UNAVAILABLE, unavailable("inference_service_unavailable"))

    def do_GET(self):
        if self.path == "/health":
            try:
                # Confirm global model loads successfully
                _ = model()
                self.reply(HTTPStatus.OK, {
                    "status": "healthy",
                    "modelIdentifier": EXPECTED_MODEL,
                    "artifactLoaded": True,
                    "experimentalStationArtifactLoaded": bool(station_model()),
                    "experimentalStationCount": len(station_model().get("stations", {})),
                    "operationalEligibility": False
                })
            except Exception as e:
                self.reply(HTTPStatus.SERVICE_UNAVAILABLE, {
                    "status": "unhealthy",
                    "error": "artifact_load_failure"
                })
        elif self.path == "/v1/station-forecast/stations":
            token = os.environ.get("JALDRISHTI_MODEL_SERVICE_TOKEN", "")
            if not token or not hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {token}"):
                self.reply(HTTPStatus.UNAUTHORIZED, {"status": "unavailable", "reason": "unauthorized"}); return
            try:
                stations = []
                for station_id, entry in sorted(station_model().get("stations", {}).items()):
                    parts = station_id.split("::", 2)
                    if len(parts) == 3:
                        stations.append({"stationId": station_id, "state": parts[0], "district": parts[1], "stationName": parts[2], "latestDate": entry["latest_date"], "horizonDays": 7})
                self.reply(HTTPStatus.OK, {"status": "available", "stations": stations, "operationalEligibility": False})
            except FileNotFoundError:
                self.reply(HTTPStatus.SERVICE_UNAVAILABLE, {"status": "unavailable", "reason": "station_model_artifact_unavailable"})
        else:
            self.reply(HTTPStatus.NOT_FOUND, unavailable("not_found"))


if __name__ == "__main__":
    if "JALDRISHTI_MODEL_SERVICE_TOKEN" not in os.environ:
        os.environ["JALDRISHTI_MODEL_SERVICE_TOKEN"] = "local_preview_secure_token_32_chars"
    port = int(os.environ.get("JALDRISHTI_MODEL_SERVICE_PORT", "8081"))
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
