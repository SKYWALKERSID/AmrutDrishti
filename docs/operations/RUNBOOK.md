# AMRUT DRISHTI — OPERATIONAL RUNBOOK

## 1. Prerequisites & Environment Setup

- **Node.js:** v20+ (developed and verified on Node.js v24.19.0).
- **Python:** 3.11+ (verified with scikit-learn, joblib, fastapi, uvicorn, pytest).
- **Database:** Supabase PostgreSQL instance with PostGIS extensions.

### Environment Configuration (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# ML Model Bridge
AMRUTDRISHTI_MODEL_SERVICE_URL=http://127.0.0.1:8081
AMRUTDRISHTI_MODEL_SERVICE_TOKEN=local-dev-model-bridge-token-2026-secure
```

---

## 2. Running the System Locally

### Step 1: Start the ML Model Inference Server
```powershell
python scripts/run_serving.py
```
- Listens on `http://127.0.0.1:8081`.
- Health check: `GET http://127.0.0.1:8081/health`.
- Expected status: `{"status": "healthy", "modelIdentifier": "GlobalBlockAwareQuantileGB-v1", "artifactLoaded": true}`.

### Step 2: Build & Start the Next.js Production Web Application
```powershell
# Build production bundle
npm run build

# Start production server
npm run start
```
- Web Application: `http://localhost:3000`.
- Key Routes:
  - Overview: `http://localhost:3000/overview`
  - Map Explorer: `http://localhost:3000/explorer`
  - Monitoring: `http://localhost:3000/monitoring?block=blk_tikamgarh_main`
  - Risk Assessment: `http://localhost:3000/risk-assessment?block=blk_tikamgarh_main`
  - Interventions: `http://localhost:3000/interventions?block=blk_tikamgarh_main`

---

## 3. Running Test Suites

### Node.js Full Integration & Component Suite
```powershell
npm test
```
- Runs 38 test suites covering 237 test assertions using Node test runner.

### TypeScript Strict Compilation Check
```powershell
npx tsc --noEmit
```

### Python ML & Ingestion Test Suite
```powershell
python -m pytest tests_py
```
- Runs 113 unit and integration tests across models, baselines, ingestion, and serving.

---

## 4. Troubleshooting & Operational Guidance

| Symptom | Diagnostic Step | Resolution |
|:---|:---|:---|
| **Forecast returns 503 / Unavailable** | Check if port 8081 is listening: `Get-NetTCPConnection -LocalPort 8081` | Start `python scripts/run_serving.py`. Verify `AMRUTDRISHTI_MODEL_SERVICE_URL` in `.env.local`. |
| **Historical observations show 0 records** | Query `/api/historical-observations?block=<id>` | Expected for blocks without Supabase table records; frontend cleanly falls back to local verified series. |
| **`operationalEligibility: false` warning** | Check model forecast JSON response | Expected by design. Operational eligibility requires field piezometer network calibration; do not force to true. |
| **Observation freshness banner appears** | Observation age exceeds 400 days from current date | Genuine historical archive behavior. Distinguishes legacy records from real-time DWLR telemetry. |
