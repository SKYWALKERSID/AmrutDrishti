# JalDrishti — Phase One: Requirements Traceability Audit

**Document File:** `docs/audit/01_requirements_traceability.md`  
**Audit Standard:** Strict verification of functional and technical requirements against actual code in `src/`, `supabase/migrations/`, and `tests/`.

---

## 1. Traceability Matrix

| Requirement ID | Requirement Summary | Target Implementation Path | Existence in Repo | Connected to App | Verified Working | Audit Status | Evidence & Gaps |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **FR-001** | Multi-Role Governance Switching | [`src/components/Navigation.tsx`](file:///D:/Projects/JalDrishti/src/components/Navigation.tsx) | YES | YES | YES | **SIMULATED OR FIXTURE-BASED** | Switches client-side role context (District Collector, BDO, etc.). Does not authenticate against Supabase Auth sessions. |
| **FR-010** | Bundelkhand Pilot Spatial Map Explorer | [`src/components/MapExplorer.tsx`](file:///D:/Projects/JalDrishti/src/components/MapExplorer.tsx) | YES | YES | YES | **VERIFIED WORKING** | Leaflet maps pilot blocks and stations. Gracefully falls back to fixtures if DB permissions fail. |
| **FR-012** | CGWB Well Depth Monitoring Charts | [`src/app/monitoring/page.tsx`](file:///D:/Projects/JalDrishti/src/app/monitoring/page.tsx) | YES | YES | YES | **SIMULATED OR FIXTURE-BASED** | Multi-indicator Recharts time-series visualizer renders accurately with static sample series. |
| **FR-020** | GRACE Regional TWSA Anomaly Layer | [`src/components/MapExplorer.tsx`](file:///D:/Projects/JalDrishti/src/components/MapExplorer.tsx) | YES | YES | YES | **SIMULATED OR FIXTURE-BASED** | Layer switcher displays GRACE gravity anomaly indicators with mandatory coarse-scale (~100km) disclaimer. |
| **FR-030** | Groundwater Stress Score (GSS) Engine | [`src/lib/services/scientificEngine.ts`](file:///D:/Projects/JalDrishti/src/lib/services/scientificEngine.ts) | YES | YES | YES | **VERIFIED WORKING** | Computes descriptive multi-criteria score (0-100). Preserves null indicators without converting to zero. |
| **FR-032** | Human Review & Risk Override Workflow | [`src/app/risk-assessment/page.tsx`](file:///D:/Projects/JalDrishti/src/app/risk-assessment/page.tsx) | YES | YES | YES | **SIMULATED OR FIXTURE-BASED** | Form requires written rationale for overriding block risk score; stores overrides in local React state. |
| **FR-040** | Supported Government Schemes Directory | [`src/app/interventions/page.tsx`](file:///D:/Projects/JalDrishti/src/app/interventions/page.tsx) | YES | YES | YES | **VERIFIED WORKING** | Catalogs PMKSY, MGNREGA, Atal Bhujal Yojana, and Amrit Sarovar schemes. |
| **FR-042** | Intervention Proposal Submission Workspace | [`src/app/interventions/page.tsx`](file:///D:/Projects/JalDrishti/src/app/interventions/page.tsx) | YES | YES | YES | **SIMULATED OR FIXTURE-BASED** | Proposal form captures structure type, budget, and hydrogeological justification in client state. |
| **FR-050** | Hindi-First Advisory Template Engine | [`src/app/alerts/page.tsx`](file:///D:/Projects/JalDrishti/src/app/alerts/page.tsx) | YES | YES | YES | **VERIFIED WORKING** | Bilingual advisory engine populates variables dynamically in Hindi and English. |
| **FR-056** | Mandatory Safe Wording Policy | [`src/app/alerts/page.tsx`](file:///D:/Projects/JalDrishti/src/app/alerts/page.tsx) | YES | YES | YES | **VERIFIED WORKING** | Strictly forbids panic terminology ("days-to-crisis countdowns") and enforces empirical advisories. |
| **FR-060** | Multi-Channel Advisory Dispatch | [`src/app/alerts/page.tsx`](file:///D:/Projects/JalDrishti/src/app/alerts/page.tsx) | YES | YES | NO | **SIMULATED OR FIXTURE-BASED** | Advisory dispatch simulator logs simulated dispatches; no external SMS/WhatsApp gateway connected. |
| **FR-070** | Data Ingestion & Source Provenance Monitor | [`src/app/data-sources/page.tsx`](file:///D:/Projects/JalDrishti/src/app/data-sources/page.tsx) | YES | YES | YES | **VERIFIED WORKING** | Displays metadata registry and quality flags across IMD, CGWB, GRACE, SMAP, and Sentinel-2. |
| **FR-080** | Immutable Governance Audit Log Viewer | [`src/app/admin/page.tsx`](file:///D:/Projects/JalDrishti/src/app/admin/page.tsx) | YES | YES | YES | **SIMULATED OR FIXTURE-BASED** | Displays audit activity table using in-memory session records. |
| **TR-001** | Next.js 15 App Router Architecture | [`src/app/`](file:///D:/Projects/JalDrishti/src/app/) | YES | YES | YES | **VERIFIED WORKING** | Next.js 15.5.27 compiles cleanly (`npm run build` exits 0). |
| **TR-005** | TypeScript Strict Type Safety | [`tsconfig.json`](file:///D:/Projects/JalDrishti/tsconfig.json) | YES | YES | YES | **VERIFIED PARTIAL** | Core application compiles with zero type errors; 3 test mock definitions require union type adjustments. |
| **TR-010** | Supabase PostgREST & PostGIS Schema | [`supabase/migrations/`](file:///D:/Projects/JalDrishti/supabase/migrations/) | YES | YES | NO | **VERIFIED PARTIAL** | Schema defines 14 tables, spatial indexes, and RLS; migration `20261011000002` unexecuted on remote DB. |
| **TR-015** | Design Token System & Master Vibe Rules | [`src/app/globals.css`](file:///D:/Projects/JalDrishti/src/app/globals.css) | YES | YES | YES | **VERIFIED WORKING** | Adheres to warm `#f8f7f4` background, dark text, restrained teal accent, zero prohibited patterns. |
| **TR-025** | Automated Test Automation Suite | [`tests/`](file:///D:/Projects/JalDrishti/tests/) | YES | YES | YES | **VERIFIED WORKING** | 130 tests covering calculations, mappers, auth policies, and ingestion passing at 100%. |

---

## 2. Unresolved Requirements & Gaps
1. **Remote Database Connectivity:** Backend schemas exist, but production RLS policies and public grants are pending remote database execution.
2. **Official Block Boundaries:** Geospatial polygons represent revenue tehsils rather than official LGD Community Development Blocks.
3. **Forecasting Claims:** No predictive machine learning models are deployed; GSS must remain labeled as a descriptive indicator.
