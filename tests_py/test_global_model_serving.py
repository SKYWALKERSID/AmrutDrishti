import unittest

from ml.serving import infer, validate_request


class TestGlobalModelServing(unittest.TestCase):
    def valid_payload(self):
        return {
            "contractVersion": "global-forecast/v1",
            "trustedObservationSource": "internal_verified_block_observations",
            "geography": {"state": "Punjab", "district": "HOSHIARPUR", "block": "MUKERIAN", "blockId": "fixture"},
            "observations": [
                {"stationId": "synthetic-test-only", "observationDate": "2026-01-01", "depthMbgl": 10.0, "units": "m bgl"},
                {"stationId": "synthetic-test-only", "observationDate": "2026-04-01", "depthMbgl": 10.2, "units": "m bgl"},
            ],
        }

    def test_valid_synthetic_fixture_uses_global_model(self):
        response = infer(self.valid_payload())
        self.assertEqual(response["status"], "research_prototype")
        self.assertEqual(response["modelIdentifier"], "GlobalBlockAwareQuantileGB-v1")
        self.assertEqual(response["intervalStatus"], "ordered_uncalibrated")
        self.assertFalse(response["operationalEligibility"])

    def test_rejects_untrusted_source_and_multi_station_payload(self):
        payload = self.valid_payload()
        payload["trustedObservationSource"] = "browser"
        with self.assertRaises(ValueError): validate_request(payload)
        payload = self.valid_payload()
        payload["observations"][1]["stationId"] = "other"
        with self.assertRaises(ValueError): validate_request(payload)

    def test_rejects_unknown_geography_and_units(self):
        payload = self.valid_payload()
        payload["geography"]["block"] = "not-a-real-block"
        with self.assertRaises(ValueError): infer(payload)
        payload = self.valid_payload()
        payload["observations"][0]["units"] = "feet"
        with self.assertRaises(ValueError): validate_request(payload)

    def test_rejects_nonfinite_depth_and_invalid_observation_date(self):
        payload = self.valid_payload()
        payload["observations"][0]["depthMbgl"] = float("nan")
        with self.assertRaises(ValueError): validate_request(payload)
        payload = self.valid_payload()
        payload["observations"][0]["observationDate"] = "not-a-date"
        with self.assertRaises(ValueError): validate_request(payload)

    def test_live_http_serving_endpoints(self):
        import json, os, threading, time, urllib.request
        from ml.serving import Handler, ThreadingHTTPServer

        os.environ["JALDRISHTI_MODEL_SERVICE_TOKEN"] = "test-live-token-secret"
        server = ThreadingHTTPServer(("127.0.0.1", 8098), Handler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        time.sleep(0.1)
        try:
            # 1. Health check
            with urllib.request.urlopen("http://127.0.0.1:8098/health") as resp:
                self.assertEqual(resp.status, 200)
                h = json.loads(resp.read().decode())
                self.assertEqual(h["status"], "healthy")
                self.assertEqual(h["modelIdentifier"], "GlobalBlockAwareQuantileGB-v1")
                self.assertFalse(h["operationalEligibility"])

            # 2. Unauthorized predict
            req = urllib.request.Request(
                "http://127.0.0.1:8098/v1/forecast",
                data=b"{}",
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                urllib.request.urlopen(req)
            self.assertEqual(ctx.exception.code, 401)

            # 3. Authorized predict
            req_auth = urllib.request.Request(
                "http://127.0.0.1:8098/v1/forecast",
                data=json.dumps(self.valid_payload()).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer test-live-token-secret"
                },
                method="POST"
            )
            with urllib.request.urlopen(req_auth) as resp:
                self.assertEqual(resp.status, 200)
                body = json.loads(resp.read().decode())
                self.assertEqual(body["status"], "research_prototype")
                self.assertEqual(body["modelIdentifier"], "GlobalBlockAwareQuantileGB-v1")
                self.assertEqual(body["intervalStatus"], "ordered_uncalibrated")
                self.assertFalse(body["operationalEligibility"])
                forecasts = body["forecast"]["forecasts"]
                self.assertEqual(len(forecasts), 4)
                for f in forecasts:
                    p10 = f["uncertaintyInterval"]["lowerBoundP10Mbgl"]
                    p50 = f["expectedDepthMbgl"]
                    p90 = f["uncertaintyInterval"]["upperBoundP90Mbgl"]
                    self.assertTrue(p10 <= p50 <= p90)

            # The distinct NWDP route must use the real station artifact and preserve lineage.
            station_list_req = urllib.request.Request(
                "http://127.0.0.1:8098/v1/station-forecast/stations",
                headers={"Authorization": "Bearer test-live-token-secret"},
            )
            with urllib.request.urlopen(station_list_req) as resp:
                station_list = json.loads(resp.read().decode())
            self.assertEqual(station_list["status"], "available")
            self.assertFalse(station_list["operationalEligibility"])
            self.assertTrue(station_list["stations"])
            station_id = station_list["stations"][0]["stationId"]
            station_req = urllib.request.Request(
                "http://127.0.0.1:8098/v1/station-forecast",
                data=json.dumps({"stationId": station_id, "horizonDays": 7}).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer test-live-token-secret",
                },
                method="POST",
            )
            with urllib.request.urlopen(station_req) as resp:
                station_result = json.loads(resp.read().decode())
            self.assertEqual(station_result["status"], "experimental")
            self.assertEqual(station_result["stationId"], station_id)
            self.assertEqual(station_result["forecastHorizonDays"], 7)
            self.assertFalse(station_result["operationalEligibility"])
            self.assertEqual(station_result["intervalStatus"], "ordered_uncalibrated")
            self.assertTrue(station_result["provenance"]["originRecordIds"])
            self.assertEqual(len(station_result["provenance"]["sourceHashes"]), 18)
            self.assertIn("unverified", station_result["unitLabel"])
        finally:
            server.shutdown()
