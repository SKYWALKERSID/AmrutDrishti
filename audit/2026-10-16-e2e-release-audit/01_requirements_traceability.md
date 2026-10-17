# Requirements traceability

The PRD/TRD are proposed requirements, not completion evidence. Existing reconciliation identifies 12 checklist IDs; none were embedded in extracted PRD/TRD text.

| ID | Theme | Result | Evidence / gap |
|---|---|---|---|
| JD-001 | Evidence-led dashboard | Partial | provenance types/demo notices exist; live values unverified |
| JD-010 | GIS exploration | Partial | components/tests exist; no live boundary/rendering check |
| JD-020 | Monitoring | Blocked | service access invalid |
| JD-030 | Risk scoring | Failed | uncalibrated heuristic |
| JD-040 | Forecasting | Partial | research-only safeguard; model data unverified |
| JD-050 | Route/bilingual baseline | Verified | static acceptance tests pass |
| JD-060 | Interventions | Failed | no endpoint auth; memory fallback |
| JD-070 | Alerting | Partial | simulator labelled; dispatch lacks auth |
| JD-080 | Data-source health | Blocked | no provider retrieval/freshness check |
| JD-090 | Database/RLS | Blocked | remote state unavailable |
| JD-100 | Deployment | Blocked | no deployed operational evidence |
| JD-110/JD-120 | Governance/scale | Blocked | audit API and persistence not trustworthy |

Original workbook unchanged. The matrix uses static inspection, non-mutating tests/builds, and read-only service checks only.
