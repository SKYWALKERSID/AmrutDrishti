# JalDrishti — Phase Four: API & Backend Audit

**Document File:** `docs/audit/04_api_backend_audit.md`

---

## 1. Inventory of API Endpoints

### 1. Geospatial Blocks Endpoint
- **Route:** `GET /api/geospatial/blocks`
- **File:** [`src/app/api/geospatial/blocks/route.ts`](file:///D:/Projects/JalDrishti/src/app/api/geospatial/blocks/route.ts)
- **Runtime Mode:** `force-dynamic`
- **Underlying Service:** [`src/lib/services/geospatialService.ts`](file:///D:/Projects/JalDrishti/src/lib/services/geospatialService.ts)
- **Input Parameters:** None.
- **Authorization:** Public (`anon` / `authenticated`).
- **Response Structure:**
  ```json
  {
    "blocks": [...],
    "source": "live_database" | "demonstration_fixture" | "fallback_empty",
    "isDemonstrationData": boolean,
    "totalCount": number,
    "fetchedAt": string,
    "errorMessage": string | undefined
  }
  ```
- **Security & Error Handling:** Graceful fallback to `ALL_BLOCKS` on PostgREST connection errors or missing permissions. Never leaks database connection strings or secret keys.

### 2. Historical Observations Endpoint
- **Route:** `GET /api/historical-observations`
- **File:** [`src/app/api/historical-observations/route.ts`](file:///D:/Projects/JalDrishti/src/app/api/historical-observations/route.ts)
- **Runtime Mode:** `force-dynamic`
- **Input Parameters:**
  - `limit`: Integer (1–100, default 50).
  - `offset`: Integer (default 0).
  - `district`: Optional text filter.
  - `block`: Optional text filter.
  - `station`: Optional text filter.
  - `from`, `to`: Optional date string matching `^\d{4}-\d{2}-\d{2}$`.
- **Validation:** Strict parameter validation. Returns HTTP 400 if limit/offset are invalid or if date formats are malformed.
- **Data Source:** Views `v_published_historical_observations` in PostgreSQL.
- **Error Behavior:** Returns HTTP 503 (`{ "error": "Historical observations unavailable" }`) when the underlying view or RLS permissions are not accessible.

---

## 2. API Security Evaluation
- **SQL Injection Risks:** None. All queries use Supabase JavaScript SDK parameter binding.
- **SSRF Risks:** None. Endpoints do not accept or fetch arbitrary external URLs.
- **Overly Permissive CORS:** Standard Next.js same-origin defaults apply; no wildcard CORS headers exported.
- **Rate Limiting:** Currently relies on Next.js / Edge host defaults; explicit rate-limiting middleware is recommended before public deployment.
