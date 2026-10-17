# Data provenance and live integrations

| Integration | Observed result | Status |
|---|---|---|
| Supabase historical publication view | anon HTTP 200 | reachable; content/provenance unverified |
| Supabase service-role access | HTTP 401 for all queried tables/view | failed |
| CGWB/IMD | adapters and fixture/staged tests | not live-verified |
| GRACE/satellite | labels and ingestion script | not live-verified |
| SMS/DLT | simulator fallback | no real delivery tested |

Only environment-variable names were inspected; no values were printed. The application’s explicit demo/simulated labels are a positive presentation safeguard, not confirmation of live data. Do not rely on prior record counts: remote data could not be queried through the service role.
