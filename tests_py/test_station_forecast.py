import io
import json
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

from api import station_forecast as sf  # noqa: E402


class FakeHandler(sf.handler):
    def __init__(self, method, headers, path="/api/station_forecast", body=b""):
        self.headers = headers
        self.rfile = io.BytesIO(body)
        self.wfile = io.BytesIO()
        self.status = None
        self.method = method
        self.path = path

    def send_response(self, code, message=None):
        self.status = code

    def send_header(self, *a):
        pass

    def end_headers(self):
        pass

    def result(self):
        return self.status, json.loads(self.wfile.getvalue())


class StationForecastFunctionTests(unittest.TestCase):
    def setUp(self):
        os.environ["JALDRISHTI_MODEL_SERVICE_TOKEN"] = "test-station-secret-token"

    def test_health_check_unauthenticated(self):
        h = FakeHandler("GET", {}, path="/api/station_forecast")
        h.do_GET()
        status, body = h.result()
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "healthy")
        self.assertEqual(body["modelIdentifier"], "NWDP-Station-Experimental")
        self.assertEqual(body["horizonsDays"], [90, 180])
        self.assertGreater(body["stationCount"], 50)

    def test_stations_list_requires_auth(self):
        h = FakeHandler("GET", {}, path="/api/station_forecast?stations=true")
        h.do_GET()
        status, body = h.result()
        self.assertEqual(status, 401)

    def test_stations_list_authenticated(self):
        h = FakeHandler(
            "GET",
            {"Authorization": "Bearer test-station-secret-token"},
            path="/api/station_forecast?stations=true",
        )
        h.do_GET()
        status, body = h.result()
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "available")
        self.assertGreater(len(body["stations"]), 50)

    def test_station_forecast_90d_and_180d(self):
        body_90 = json.dumps({
            "stationId": "Haryana::KARNAL::ChocftraPz",
            "horizonDays": 90
        }).encode("utf-8")
        h = FakeHandler(
            "POST",
            {
                "Authorization": "Bearer test-station-secret-token",
                "Content-Length": str(len(body_90))
            },
            path="/api/station_forecast",
            body=body_90
        )
        h.do_POST()
        status, res = h.result()
        self.assertEqual(status, 200)
        self.assertEqual(res["forecastHorizonDays"], 90)
        self.assertEqual(res["status"], "experimental")
        self.assertLessEqual(res["prediction"]["p10"], res["prediction"]["p50"])
        self.assertLessEqual(res["prediction"]["p50"], res["prediction"]["p90"])

        # Test 180 days
        body_180 = json.dumps({
            "stationId": "Haryana::KARNAL::ChocftraPz",
            "horizonDays": 180
        }).encode("utf-8")
        h2 = FakeHandler(
            "POST",
            {
                "Authorization": "Bearer test-station-secret-token",
                "Content-Length": str(len(body_180))
            },
            path="/api/station_forecast",
            body=body_180
        )
        h2.do_POST()
        status2, res2 = h2.result()
        self.assertEqual(status2, 200)
        self.assertEqual(res2["forecastHorizonDays"], 180)


if __name__ == "__main__":
    unittest.main()
