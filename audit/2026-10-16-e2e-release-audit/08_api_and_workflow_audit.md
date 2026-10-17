# API and workflow audit

| Endpoint | Result |
|---|---|
| `/api/geospatial/blocks` | explicit empty/demo behavior; remote result unverified |
| `/api/historical-observations` | fail-closed contract tested; publication content unverified |
| `/api/forecast` | research safeguards; privileged source path/live data unavailable |
| `/api/interventions` | failed: no auth, service role, memory fallback |
| `/api/audit` | failed: no auth, caller-controlled fields, memory fallback |
| `/api/alerts/dispatch` | failed: no auth/validation before live-capable service |

## F-003 — High — non-durable success path

Intervention POST returns `success: true` after memory update despite database failure (`130-142`). Audit POST can return success with `persisted: false` (`74-113`). Required records must fail hard when durable persistence fails; demo behavior must be isolated behind explicit demo mode.
