"""Tests for the Vercel Python inference function, using real repository observations (no fixtures)."""
import io
import json
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

from api import py_forecast as pf  # noqa: E402

BLOCK_ID = "blk_kaithal_rajound"


def real_payload():
    with open(os.path.join(ROOT, "data", "derived", "cgwb_ground_truth_block_series.json"), encoding="utf-8") as f:
        series = json.load(f)[BLOCK_ID]
    with open(os.path.join(ROOT, "audit", "global_model_block_readiness.json"), encoding="utf-8") as f:
        row = next(b for b in json.load(f)["blocks"] if b["block_id"] == BLOCK_ID)
    return {
        "contractVersion": "global-forecast/v1",
        "trustedObservationSource": "internal_verified_block_observations",
        "geography": {"state": row["state"], "district": row["district"], "block": row["block_name"], "blockId": BLOCK_ID},
        "observations": [
            {"stationId": series["station_id"], "observationDate": o["observationDate"], "depthMbgl": o["depthMbgl"], "units": "m bgl"}
            for o in series["observations"]
        ],
    }


class FakeHandler(pf.handler):
    def __init__(self, method, headers, body=b""):
        self.headers = headers
        self.rfile = io.BytesIO(body)
        self.wfile = io.BytesIO()
        self.status = None
        self.method = method

    def send_response(self, code, message=None):
        self.status = code

    def send_header(self, *a):
        pass

    def end_headers(self):
        pass

    def result(self):
        return self.status, json.loads(self.wfile.getvalue())


def post(payload, token="secret", send_token=None):
    body = json.dumps(payload).encode()
    headers = {"Content-Length": str(len(body)), "Authorization": f"Bearer {send_token if send_token is not None else token}"}
    h = FakeHandler("POST", headers, body)
    os.environ["JALDRISHTI_MODEL_SERVICE_TOKEN"] = token
    h.do_POST()
    return h.result()


class PyForecastTests(unittest.TestCase):
    def test_health_ready(self):
        h = FakeHandler("GET", {})
        h.do_GET()
        status, body = h.result()
        self.assertEqual(status, 200)
        self.assertTrue(body["artifactLoaded"])
        self.assertEqual(body["modelIdentifier"], "GlobalBlockAwareQuantileGB-v1")

    def test_real_inference_90_and_180_day_ordered_quantiles(self):
        status, body = post(real_payload())
        self.assertEqual(status, 200)
        self.assertEqual(body["inferenceMode"], "live_inference")
        pts = body["forecast"]["forecasts"]
        self.assertEqual([p["forecastHorizonMonths"] for p in pts][:2], [3, 6])
        for p in pts:
            iv = p["uncertaintyInterval"]
            self.assertLessEqual(iv["lowerBoundP10Mbgl"], p["expectedDepthMbgl"])
            self.assertLessEqual(p["expectedDepthMbgl"], iv["upperBoundP90Mbgl"])
            self.assertGreater(p["targetDate"], body["originObservationDate"])

    def test_auth_required(self):
        self.assertEqual(post(real_payload(), send_token="wrong")[0], 401)

    def test_missing_server_token_rejects(self):
        body = json.dumps(real_payload()).encode()
        h = FakeHandler("POST", {"Content-Length": str(len(body)), "Authorization": "Bearer "}, body)
        os.environ["JALDRISHTI_MODEL_SERVICE_TOKEN"] = ""
        h.do_POST()
        self.assertEqual(h.result()[0], 401)

    def test_rejects_bad_payloads_without_leaking(self):
        base = real_payload()
        cases = []
        bad = json.loads(json.dumps(base)); bad["observations"][0]["units"] = "cm"; cases.append(bad)
        bad = json.loads(json.dumps(base)); bad["observations"][0]["observationDate"] = "2021-13-45"; cases.append(bad)
        bad = json.loads(json.dumps(base)); bad["contractVersion"] = "x"; cases.append(bad)
        bad = json.loads(json.dumps(base)); bad["geography"]["blockId"] = ""; cases.append(bad)
        bad = json.loads(json.dumps(base)); bad["observations"][1]["observationDate"] = bad["observations"][0]["observationDate"]; cases.append(bad)
        bad = json.loads(json.dumps(base)); bad["observations"][1]["stationId"] = "other"; cases.append(bad)
        bad = json.loads(json.dumps(base)); bad["geography"]["block"] = "No Such Block"; cases.append(bad)
        for c in cases:
            status, body = post(c)
            self.assertEqual(status, 400, c)
            self.assertNotIn("Traceback", json.dumps(body))
            self.assertNotIn(ROOT, json.dumps(body))

    def test_missing_artifact_returns_503_without_path(self):
        orig = pf.get_global_model
        def boom():
            raise FileNotFoundError(os.path.join(ROOT, "secret", "path"))
        pf.get_global_model = boom
        try:
            status, body = post(real_payload())
            self.assertEqual(status, 503)
            self.assertNotIn("secret", json.dumps(body))
        finally:
            pf.get_global_model = orig


if __name__ == "__main__":
    unittest.main()
