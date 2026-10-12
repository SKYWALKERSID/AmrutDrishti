# JalDrishti — Phase Twenty: Architecture & Design Review

**Document File:** `docs/audit/20_architecture_review.md`

---

## 1. Architectural Strengths
1. **Strict Layer Separation:**
   - **UI Layer (`src/components/`, `src/app/`):** Focused presentation components.
   - **Data Access & Mappers (`src/lib/mappers/`):** Pure transformation functions converting DB rows into UI model types.
   - **Domain & Scientific Services (`src/lib/services/`):** Standalone, framework-agnostic calculation functions for SPI-3, OLS regressions, and polygon clipping.
2. **Resilient Client Architecture:**
   - The application does not crash when backend databases or external APIs are unreachable. It falls back to well-formed demonstration fixtures with clear amber notices.
3. **Design System Discipline:**
   - 100% adherence to Master Vibe-Coding Prompt (warm neutral background `#f8f7f4`, dark readable typography, one restrained teal accent `#0d5c63`, zero forbidden 30 patterns).

---

## 2. Identified Architectural Bottlenecks & Remediation
- **Database Persistence Gap:** Several governance actions (scheme proposal creation in `/interventions` and score overrides in `/risk-assessment`) exist only in client React component state.
  - *Remediation:* Wire forms to PostgREST endpoints backed by PostgreSQL tables `intervention_proposals` and `audit_events`.
- **Scheduled Ingestion Pipeline Absence:** Adapters (`cgwbAdapter.ts`, `imdRainfallAdapter.ts`) are invoked manually via test scripts.
  - *Remediation:* Add serverless cron jobs or background scripts to orchestrate recurring updates.
- **Legacy Source Folders:** Older directories (`app_src/`, `src_new/`) remain present in the workspace.
  - *Remediation:* Archive legacy folders to eliminate developer confusion and reduce workspace clutter.
