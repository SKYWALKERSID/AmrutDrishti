"""Vercel Python Function: direct 90-day / 180-day NWDP station forecasts (experimental).

GET  /api/station_forecast               -> health/readiness (no auth, no station data)
GET  /api/station_forecast?stations=true -> authenticated station list
POST /api/station_forecast               -> authenticated {"stationId", "horizonDays": 90|180}
"""
import hmac
import json
import os
import sys
from functools import lru_cache
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml.nwdp_horizon_inference import forecast_station_horizon, list_stations, load_horizon_model  # noqa: E402

MAX_BODY_BYTES = 4 * 1024
HORIZONS = (90, 180)


@lru_cache(maxsize=1)
def get_station_model():
    return load_horizon_model()


def is_authorized(auth_header: str) -> bool:
    token = os.environ.get("JALDRISHTI_MODEL_SERVICE_TOKEN", "")
    return bool(token) and hmac.compare_digest(
        (auth_header or "").encode("utf-8"), f"Bearer {token}".encode("utf-8")
    )


def run_station_forecast(payload):
    if not isinstance(payload, dict):
        raise ValueError("invalid_payload")
    station_id, horizon = payload.get("stationId"), payload.get("horizonDays")
    if not isinstance(station_id, str) or station_id.count("::") != 2 or len(station_id) > 600:
        raise ValueError("invalid_station_id")
    if isinstance(horizon, bool) or horizon not in HORIZONS:
        raise ValueError("unsupported_horizon")
    return forecast_station_horizon(station_id, int(horizon), get_station_model())


class handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def _send_json(self, status, data):
        encoded = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _unauthorized(self):
        self._send_json(401, {"status": "unavailable", "reason": "unauthorized", "operationalEligibility": False})

    def do_GET(self):
        want_list = parse_qs(urlparse(self.path).query).get("stations") == ["true"]
        if want_list and not is_authorized(self.headers.get("Authorization", "")):
            return self._unauthorized()
        try:
            model = get_station_model()
        except Exception:
            return self._send_json(503, {"status": "unhealthy", "error": "artifact_load_failure"})
        if want_list:
            stations = list_stations(model)
            return self._send_json(200, {
                "status": "available", "operationalEligibility": False,
                "count": len(stations), "stations": stations,
            })
        meta = model["metadata"]
        self._send_json(200, {
            "status": "healthy", "runtime": f"python-{sys.version.split()[0]}",
            "modelIdentifier": meta["model_identifier"], "modelVersion": meta["version"],
            "horizonsDays": list(HORIZONS), "stationCount": len(model["stations"]),
            "operationalEligibility": False,
        })

    def do_POST(self):
        if not is_authorized(self.headers.get("Authorization", "")):
            return self._unauthorized()
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError("invalid_request_size")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            self._send_json(200, run_station_forecast(payload))
        except KeyError as err:
            reason = "station_horizon_not_trained" if "horizon" in str(err) else "station_not_trained"
            self._send_json(404, {"status": "unavailable", "reason": reason, "operationalEligibility": False})
        except (ValueError, TypeError) as err:
            code = str(err)
            known = {"invalid_payload", "invalid_station_id", "unsupported_horizon", "invalid_request_size",
                     "insufficient_recent_station_history", "quantile_crossing", "invalid_station_history_order"}
            self._send_json(400 if code in {"invalid_payload", "invalid_station_id", "unsupported_horizon", "invalid_request_size"} else 422,
                            {"status": "unavailable", "reason": code if code in known else "invalid_payload",
                             "operationalEligibility": False})
        except FileNotFoundError:
            self._send_json(503, {"status": "unavailable", "reason": "model_artifact_unavailable", "operationalEligibility": False})
        except Exception:
            self._send_json(500, {"status": "unavailable", "reason": "internal_inference_error", "operationalEligibility": False})
