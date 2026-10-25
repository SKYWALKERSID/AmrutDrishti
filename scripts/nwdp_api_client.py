"""
Official NWDP/NWIC API Client for JAL DRISHTI.
Implements bounded, paginated, and filtered access to NWDP CKAN DataStore endpoints
(specifically `datastore_search` and `package_show`) with exponential backoff and retries.
"""

import json
import ssl
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

NWDP_BASE_URL = "https://nwdp.nwic.gov.in"
DATASTORE_SEARCH_ENDPOINT = f"{NWDP_BASE_URL}/api/3/action/datastore_search"
PACKAGE_SHOW_ENDPOINT = f"{NWDP_BASE_URL}/api/3/action/package_show"

class NWDPAPIClient:
    def __init__(self, timeout: int = 20, max_retries: int = 3, backoff_factor: float = 1.5):
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.ctx = ssl._create_unverified_context()

    def _make_request(self, url: str) -> Dict[str, Any]:
        headers = {
            "User-Agent": "JalDrishti-Groundwater-Intelligence/1.0 (MoJS/NWIC Telemetry Ingestion)",
            "Accept": "application/json"
        }
        req = urllib.request.Request(url, headers=headers)
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                with urllib.request.urlopen(req, context=self.ctx, timeout=self.timeout) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        if data.get("success"):
                            return data
                        else:
                            raise RuntimeError(f"NWDP API returned success=False: {data.get('error')}")
                    else:
                        raise RuntimeError(f"HTTP status {resp.status} from {url}")
            except Exception as e:
                last_error = e
                if attempt < self.max_retries:
                    sleep_time = self.backoff_factor ** attempt
                    time.sleep(sleep_time)
                else:
                    break
        raise RuntimeError(f"Failed to query NWDP API after {self.max_retries} attempts: {last_error}")

    def get_package_info(self, package_id: str) -> Dict[str, Any]:
        """Fetch package metadata and resources via package_show."""
        url = f"{PACKAGE_SHOW_ENDPOINT}?id={urllib.parse.quote(package_id)}"
        resp = self._make_request(url)
        return resp.get("result", {})

    def search_datastore(
        self,
        resource_id: str,
        filters: Optional[Dict[str, Any]] = None,
        q: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        sort: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query records from CKAN datastore_search.
        Supports filtering by fields (e.g. {'District': 'Chikkamagaluru', 'Station': 'Aanegere'}).
        """
        params: Dict[str, Any] = {
            "resource_id": resource_id,
            "limit": min(limit, 10000),
            "offset": offset
        }
        if filters:
            params["filters"] = json.dumps(filters)
        if q:
            params["q"] = q
        if sort:
            params["sort"] = sort

        query_str = urllib.parse.urlencode(params)
        url = f"{DATASTORE_SEARCH_ENDPOINT}?{query_str}"
        resp = self._make_request(url)
        return resp.get("result", {})

    def fetch_station_recent_records(
        self,
        resource_id: str,
        station_name: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Fetch the most recent readings for a specific station from an active telemetry resource.
        """
        result = self.search_datastore(
            resource_id=resource_id,
            filters={"Station": station_name},
            limit=limit,
            sort="_id desc"
        )
        return result.get("records", [])

if __name__ == "__main__":
    client = NWDPAPIClient()
    print("Testing NWDPAPIClient with Karnataka 2026-2030 telemetry resource...")
    # Karnataka 2026-2030 resource ID
    karnataka_res_id = "97fc90ea-7275-436d-8202-cfcfe089c7f8"
    records = client.fetch_station_recent_records(karnataka_res_id, "Aanegere", limit=5)
    print(f"Retrieved {len(records)} records for station Aanegere:")
    for r in records:
        print(f"  Acq Time: {r.get('Data Acquisition Time')} | Depth: {r.get('Groundwater Level Telemetry 6 Hourly (meter)')} m bgl | Dist: {r.get('District')}")
