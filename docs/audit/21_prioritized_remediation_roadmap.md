# JalDrishti — Phase Twenty-One: Prioritized Remediation Roadmap

This execution plan converts all audit findings into a realistic, dependency-ordered engineering sequence across 8 progressive phases.

---

## 1. Action Priority Definitions
- **P0 — Critical:** Blocks remote data connectivity, introduces permission/security vulnerabilities, or creates false scientific impressions.
- **P1 — High:** Breaks real-data user flows, lacks key data bindings, or leaves core calculations disconnected.
- **P2 — Medium:** Data quality, UI persistence, schema coverage, and edge-case handling.
- **P3 — Low:** Cosmetic enhancements, documentation updates, and operational polish.

---

## 2. Master Remediation Sequence

### Phase A: Database Security & Permissions (P0)
- **TASK-A01 [P0]: Apply Permissions Remediation Migration to Remote Supabase**
  - **Issue:** Migration `20261011000002_permissions_remediation.sql` is pending on remote DB (`gejsibmhqwqrqukewqpi`), causing 42501 permission denied errors.
  - **Action:** DB Administrator executes `20261011000002_permissions_remediation.sql` in a safe transaction on Supabase.
  - **Acceptance Criteria:** `anon` key can read `administrative_units` and `v_published_historical_observations` via PostgREST.

### Phase B: Geospatial Boundary Resolution (P0 / P1)
- **TASK-B01 [P0]: Resolve LGD Development Block vs. SOI Tehsil Boundaries**
  - **Issue:** `pilot_subdistricts_soi_2025.geojson` maps subdistrict/tehsil boundaries instead of Community Development Blocks.
  - **Action:** Obtain official LGD (Local Government Directory) Block GeoJSON or document an explicit spatial concordance table between revenue tehsils and development blocks.
  - **Acceptance Criteria:** Blocks (Bijawar, Rajnagar, Baldeogarh, Jatara, Palera, Tikamgarh) have validated spatial geometries with known area discrepancies documented.

### Phase C: Wire Live UI to PostgREST APIs (P1)
- **TASK-C01 [P1]: Connect Overview Dashboard & Monitoring Views to Database APIs**
  - **Issue:** Currently, `/` and `/monitoring` bypass API calls and read directly from local `ALL_BLOCKS` fixture.
  - **Action:** Refactor state loaders to fetch from `/api/geospatial/blocks` and `/api/historical-observations`. Display dynamic "Live DB" vs "Demo Fixture" indicators.
  - **Acceptance Criteria:** With valid database rows, UI renders live records; displays clean "No data recorded" empty state when unpopulated.

### Phase D: Persist Interventions & Governance Actions (P2)
- **TASK-D01 [P2]: Persist Scheme Proposals to `intervention_proposals` Table**
  - **Issue:** In `/interventions`, submitted proposals live only in temporary client React state.
  - **Action:** Wire proposal submission form to Supabase `intervention_proposals` table with District Collector / BDO role checks.
  - **Acceptance Criteria:** Created proposals persist across page reloads and adhere to district scoping.

### Phase E: Production Ingestion Automation (P2)
- **TASK-E01 [P2]: Script Automated Ingestion for CGWB Quarterly & IMD NetCDF**
  - **Issue:** Adapters exist in code, but there is no CLI script or Supabase Edge Function to periodically ingest new official releases.
  - **Action:** Build `scripts/ingest_cgwb.ts` and `scripts/ingest_imd.ts` to process staged files into `station_observations` and `derived_indicators`.
  - **Acceptance Criteria:** Ingestion runs idempotently without duplicating observation timestamps.

### Phase F: Scientific Model & Disclosure Integrity (P1 / P2)
- **TASK-F01 [P1]: Enforce Mandatory Scientific Safeguard Disclaimers in UI**
  - **Issue:** GSS score could be mistaken for an official CGWB drought declaration or ML prediction.
  - **Action:** Ensure all screens label GSS as a "Descriptive Multi-Criteria Indicator (Heuristic)" and clearly note that machine learning forecasting is not currently deployed.
  - **Acceptance Criteria:** 100% compliance with Safe Wording Policy (FR-056); zero references to unvalidated predictive claims.

### Phase G: TypeScript & Build Hardening (P2)
- **TASK-G01 [P2]: Resolve Strict Type Annotations in Test Mocks**
  - **Issue:** `tsc --noEmit` flags 3 minor type mismatches in test files (`geospatialService.test.ts`, `imdRainfallIntegration.test.ts`, `stage5ClaimsAndSafety.test.ts`).
  - **Action:** Update test mock objects to match strict union types (`AdministrativeUnitRow.unit_type`, `Buffer | ArrayBuffer`, `UserRole`).
  - **Acceptance Criteria:** `npm run typecheck` exits with Code 0.

### Phase H: Operational Monitoring & Deployment (P3)
- **TASK-H01 [P3]: Add Health Check & Telemetry Route**
  - **Issue:** No `/api/health` endpoint exists for uptime monitoring or Docker container checks.
  - **Action:** Implement `/api/health` verifying database connectivity and environment variable integrity.
  - **Acceptance Criteria:** HTTP 200 with JSON status payload when DB reachable, 503 when degraded.
