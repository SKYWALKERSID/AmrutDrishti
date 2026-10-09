# JalDrishti — PRD & TRD Requirement Traceability Matrix

This matrix maps every functional requirement (FR) from `JalDrishti_Exhaustive_PRD_v1.0.docx` and technical requirement (TR) from `JalDrishti_Exhaustive_TRD_v1.0.docx` to actual codebase evidence in the repository.

---

## Status Key:
- **VERIFIED:** Implemented in code and verified via static type checks or runtime testing.
- **IMPLEMENTED, UNVERIFIED:** Code exists but lacks live backend verification.
- **SIMULATED:** UI & business logic exist backed by verified static fixtures.
- **PARTIAL:** Basic functionality exists; advanced backend workflow pending.
- **SCIENTIFICALLY UNVALIDATED:** Feature is in demonstration mode pending empirical ground-truth calibration.

---

| Req ID | Requirement Description | Code Location | Status | Evidence & Verification Notes |
| :--- | :--- | :--- | :--- | :--- |
| **FR-001** | Multi-Role Governance Dashboard | `app_src/components/Navigation.tsx` | **SIMULATED** | Local React state role switcher for District Collector, Gram Panchayat, Hydrogeologist, State Official. |
| **FR-010** | Bundelkhand Pilot Spatial Map | `app_src/components/MapExplorer.tsx` | **VERIFIED** | Interactive Leaflet GIS explorer with block boundary layers, well nodes, and satellite raster overlays. |
| **FR-012** | CGWB Monitoring Well Depth Visualizer | `app_src/app/monitoring/page.tsx` | **VERIFIED** | Recharts multi-axis line chart plotting well depth (m bgl) against historical averages. |
| **FR-020** | GRACE TWSA Spatial Anomaly Display | `app_src/components/MapExplorer.tsx` | **VERIFIED** | Regional gravity anomaly indicators integrated with clear spatial resolution disclaimers (~100km). |
| **FR-030** | Groundwater Stress Score (GSS) Engine | `app_src/app/risk-assessment/page.tsx` | **VERIFIED** | Multi-indicator weighted scoring algorithm (0-100 scale) with district risk classification. |
| **FR-032** | Human Review & Risk Override Workflow | `app_src/app/risk-assessment/page.tsx` | **VERIFIED** | Hydrogeologist override form requiring mandatory justification rationale and recording audit events. |
| **FR-040** | Supported Government Schemes Directory | `app_src/app/interventions/page.tsx` | **VERIFIED** | Comprehensive scheme registry covering Atal Bhujal Yojana, MGNREGA, JJM, Amrit Sarovar. |
| **FR-042** | Intervention Evidence Gap Checklist | `app_src/app/interventions/page.tsx` | **VERIFIED** | Interactive proposal workspace validating survey gaps, budget limits, and hydrogeological suitability. |
| **FR-050** | Hindi-First Advisory Template Engine | `app_src/app/alerts/page.tsx` | **VERIFIED** | Bilingual (Hindi/English) template generator with dynamic village/block variable substitution. |
| **FR-056** | Mandatory Safe Wording Policy | `app_src/app/alerts/page.tsx` | **VERIFIED** | Prohibition of panic wording ("days-to-crisis") enforced by template validation rules. |
| **FR-060** | Multi-Channel Advisory Dispatch | `app_src/app/alerts/page.tsx` | **SIMULATED** | Simulated SMS & WhatsApp dispatch adapter logging recipient audit logs. |
| **FR-070** | Data Ingestion & Provenance Health | `app_src/app/data-sources/page.tsx` | **VERIFIED** | System health dashboard tracking source status across CGWB, IMD, NASA GRACE, SMAP, and Sentinel-2. |
| **FR-080** | Immutable Audit Log Viewer | `app_src/app/admin/page.tsx` | **SIMULATED** | Role management and activity log view backed by in-memory session log array. |
| **TR-001** | Next.js App Router Architecture | `app_src/app/` | **VERIFIED** | Modular App Router layout structure (`layout.tsx`, `page.tsx`) with zero build compilation errors. |
| **TR-005** | TypeScript Strict Compliance | `tsconfig.json` | **VERIFIED** | Passed `tsc --noEmit` check with zero type errors. |
| **TR-012** | Apple-Inspired Design Token Palette | `app_src/app/globals.css` | **VERIFIED** | Off-white `#f8f7f4`, slate teal `#0d5c63`, cobalt `#1b4965`, sans-serif typography, zero prohibited gradients. |
| **TR-020** | Offline Spatial Vector Data Support | `app_src/lib/data/bundelkhand.ts` | **VERIFIED** | Bundelkhand geo-fixtures containing 8 districts, 45 blocks, and 120 monitoring well coordinates. |
