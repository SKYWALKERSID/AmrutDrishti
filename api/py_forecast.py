"""Prototype Vercel Python Serverless Function for Jal Drishti ML Inference.

Designed to run within Vercel's Python runtime under /api/py_forecast.
Supports GET /api/py_forecast (health check) and POST /api/py_forecast (real prediction).
"""
import hmac
import json
import math
import os
import sys
from datetime import date, datetime, timezone
from functools import lru_cache
from http.server import BaseHTTPRequestHandler

# Add repo root to sys.path so ml modules are discoverable
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml.inference import (
    load_global_model_artifact,
    forecast_from_observation_series,
    resolve_global_geographic_context,
)

MAX_BODY_BYTES = 64 * 1024
EXPECTED_MODEL = "GlobalBlockAwareQuantileGB-v1"


@lru_cache(maxsize=1)
def get_global_model():
    return load_global_model_artifact()


def validate_forecast_request(payload: dict):
    if not isinstance(payload, dict) or payload.get("contractVersion") != "global-forecast/v1":
        raise ValueError("invalid_contract")
    geography = payload.get("geography")
    source = payload.get("trustedObservationSource")
    observations = payload.get("observations")

    if not isinstance(geography, dict) or not all(
        isinstance(geography.get(k), str) and geography[k].strip()
        for k in ("state", "district", "block", "blockId")
    ):
        raise ValueError("invalid_geography")
    if source != "internal_verified_block_observations":
        raise ValueError("untrusted_observation_source")
    if not isinstance(observations, list) or not 2 <= len(observations) <= 256:
        raise ValueError("invalid_observations")

    station_ids = {
        str(item.get("stationId", "")).strip()
        for item in observations
        if str(item.get("stationId", "")).strip()
    }
    if len(station_ids) != 1:
        raise ValueError("ambiguous_or_missing_station")
    primary_station = next(iter(station_ids))

    seen_dates = set()
    for item in observations:
        if not isinstance(item, dict):
            raise ValueError("invalid_observation_schema")
        if item.get("observationDate") in seen_dates:
            raise ValueError("duplicate_observation_date")
        seen_dates.add(item.get("observationDate"))
        if str(item.get("stationId", "")).strip() != primary_station:
            raise ValueError("ambiguous_or_missing_station")
        depth = item.get("depthMbgl")
        try:
            valid_date = isinstance(item.get("observationDate"), str) and date.fromisoformat(
                item["observationDate"]
            )
        except ValueError:
            valid_date = False
        if (
            item.get("units") != "m bgl"
            or not valid_date
            or isinstance(depth, bool)
            or not isinstance(depth, (int, float))
            or not math.isfinite(depth)
        ):
            raise ValueError("invalid_observation_schema")
        if depth < 0 or depth > 150:
            raise ValueError("invalid_observation_schema")

    return geography, sorted(observations, key=lambda r: r["observationDate"]), primary_station


def run_inference(payload: dict):
    geography, records, station = validate_forecast_request(payload)
    model = get_global_model()
    resolve_global_geographic_context(
        model, geography["state"], geography["district"], geography["block"]
    )
    observations = [
        {"date": r["observationDate"], "depth_mbgl": r.get("depthMbgl")} for r in records
    ]
    result = forecast_from_observation_series(
        observations,
        geography["state"],
        geography["blockId"],
        geography["block"],
        geography["district"],
        station_name=station,
        num_horizons=4,
    )

    if result.get("modelStatus") != "research_prototype" or not result.get("forecasts"):
        return {
            "status": "unavailable",
            "reason": "inference_unavailable",
            "operationalEligibility": False,
            "intervalStatus": "ordered_uncalibrated",
        }

    return {
        "status": "research_prototype",
        "modelIdentifier": EXPECTED_MODEL,
        "modelVersion": "1.0.0",
        "geography": geography,
        "originObservationDate": result["latestObservationDate"],
        "units": "m bgl",
        "intervalStatus": "ordered_uncalibrated",
        "operationalEligibility": False,
        "inferenceMode": "live_inference",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "forecast": result,
    }


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless handler entrypoint."""

    def log_message(self, *_args):
        return  # Do not log sensitive payload material to standard error

    def _send_json(self, status: int, data: dict):
        encoded = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        """Health and readiness diagnostic check."""
        try:
            m = get_global_model()
            self._send_json(
                200,
                {
                    "status": "healthy",
                    "runtime": f"python-{sys.version.split()[0]}",
                    "modelIdentifier": EXPECTED_MODEL,
                    "artifactLoaded": bool(m is not None),
                    "operationalEligibility": False,
                    "targetHorizonQuarters": [1, 2, 3, 4],
                    "targetDays": [90, 180, 270, 360],
                },
            )
        except Exception:
            self._send_json(
                503,
                {"status": "unhealthy", "error": "artifact_load_failure"},
            )

    def do_POST(self):
        """Authenticated prediction endpoint matching global forecast contract."""
        expected_token = os.environ.get("JALDRISHTI_MODEL_SERVICE_TOKEN", "")
        auth_header = self.headers.get("Authorization", "")
        
        # In production, require strict Bearer token; if not configured in environment, reject
        if not expected_token or not hmac.compare_digest(
            auth_header.encode("utf-8"), f"Bearer {expected_token}".encode("utf-8")
        ):
            self._send_json(
                401,
                {
                    "status": "unavailable",
                    "reason": "unauthorized",
                    "operationalEligibility": False,
                },
            )
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > MAX_BODY_BYTES:
                raise ValueError("invalid_request_size")

            body_bytes = self.rfile.read(content_length)
            payload = json.loads(body_bytes.decode("utf-8"))
            result = run_inference(payload)
            self._send_json(200, result)
        except (ValueError, TypeError) as err:
            code = str(err)
            known = {
                "invalid_contract", "invalid_geography", "untrusted_observation_source",
                "invalid_observations", "ambiguous_or_missing_station",
                "invalid_observation_schema", "duplicate_observation_date", "invalid_request_size",
            }
            self._send_json(
                400,
                {
                    "status": "unavailable",
                    "reason": "invalid_request",
                    "detail": code if code in known else "invalid_payload",
                    "operationalEligibility": False,
                },
            )
        except FileNotFoundError:
            self._send_json(
                503,
                {
                    "status": "unavailable",
                    "reason": "model_artifact_unavailable",
                    "operationalEligibility": False,
                },
            )
        except Exception:
            self._send_json(
                500,
                {
                    "status": "unavailable",
                    "reason": "internal_inference_error",
                    "operationalEligibility": False,
                },
            )
