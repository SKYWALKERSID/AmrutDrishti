# JalDrishti Content Audit, Terminology and Governance

Source for DBIM guidance: the DBIM Toolkit CMS entries for Typography (5 items) and Content (6 items), retrieved earlier from
`https://dbimtoolkit.digifootprint.gov.in/cms/wp-json/wp/v2/`. The Colours and Introduction chapters were covered in an earlier task.
Rules below marked "project rule" are this project's own principles, not DBIM requirements.

## 1. Highest-impact problems found (status)

| # | Problem | Location | Status |
|---|---------|----------|--------|
| 1 | Hardcoded KPI values (-4.2 cm, -18.4 %, 12.4 m bgl) shown as live figures | `overview/page.tsx` | Fixed: computed from listed blocks, "—" if none |
| 2 | Hardcoded "Regional Mean: 12.4 m bgl" | `page.tsx` hero | Fixed: replaced with unit explanation |
| 3 | Uncited statistics (60 % irrigation, 85 % drinking water) | `page.tsx` | Fixed: removed, no source verified |
| 4 | Model version contradiction (v1.0 vs v2.0) | `page.tsx` | Fixed: v2.0, matching API default and footer |
| 5 | "Rigorously benchmarked" wording implying model quality | `page.tsx` | Fixed: states benchmark is provisional, no superiority shown |
| 6 | Hardcoded test counts ("100% pass", "74 passing") used as evidence | `page.tsx` | Fixed: states tests cover code behaviour, not accuracy |
| 7 | Data Sources listed Sikkim among eight states; omitted Meghalaya | `data-sources/page.tsx` | Fixed: canonical eight states |
| 8 | "Live Telemetry", "Recent Baseline", "N Active" statuses without defined meaning | `data-sources/page.tsx` | Fixed: plain statements |
| 9 | Rainfall caption claimed "verified IMD products without synthetic series" while observed total is derived in the UI | `monitoring/page.tsx` | Fixed: caption explains derivation |
| 10 | Hardcoded freshness dates ("Cutoff 2026-10-12", "October 2026") | landing, data sources | Fixed on those two pages |
| 11 | Footer names differed from navigation names | `Footer.tsx` | Fixed |
| 12 | Hero H1 and tagline were generic/marketing | `page.tsx`, `Navigation.tsx` | Fixed |

## 2. Remaining issues (not fixed, with reasons)

- `overview/page.tsx`, `monitoring`, `risk-assessment`, `interventions`: fallback dates such as `'2026-10-12'` still appear when the API returns no date. Removing them needs a data-contract decision.
- `alerts/page.tsx`: simulated notification records use a fixed `confidenceScore: 0.89`, and default recipient "BDO Tikamgarh" with a placeholder phone. These are simulation fixtures and should be reworked with the alert data model; the "no real message is sent" banner remains.
- `interventions/page.tsx`: request header uses district `Tikamgarh`. This is behaviour, not copy; flagged because it may imply Bundelkhand focus.
- `risk-assessment/page.tsx`: weights (35/30/20/15 %) are hardcoded in the table copy; they should be read from the scoring engine so copy cannot drift from calculation.
- Most remaining pages still carry long landing-page gap-analysis text ("Research Gap 1..5", "Software Gap 1..") that is partly repetitive. Not condensed in this pass.
- `terms`, `privacy`: draft legal text not reviewed against actual data practices; they must be reviewed by a person with legal responsibility before use.
- Hindi translations were not re-reviewed.
- Rendered desktop/mobile inspection by browser was NOT possible (Playwright could not install). See verification notes.

## 3. Terminology (canonical)

| Term | Use | Must not be confused with |
|------|-----|---------------------------|
| Depth to water (m bgl) | Distance from ground surface to water level, in metres below ground level, measured at a well | Satellite storage anomaly |
| Observation well / monitoring station | Physical well where depth is measured (CGWB/NWIC DWLR) | Block or district |
| Satellite water-storage anomaly (GRACE-FO TWSA, cm) | Regional change in total stored water, about 100 km grid | A well-level measurement |
| Rainfall difference (mm) | Monsoon rainfall minus the 1991–2020 Long Period Average (LPA) | Rainfall total |
| Groundwater Stress Score (GSS, 0–100) | Descriptive research index combining four indicators | Official risk class, validated label |
| Forecast | Research-stage model output, P10–P90 range | Observation, official warning |
| Persistence baseline | Simple reference (last or same-season value) | Model |
| Simulated | Created in the demo; nothing is sent | Operational alert |

Acronyms to expand on first use per page: CGWB, NWIC, DWLR, IMD, LPA, TWSA, GRACE-FO, GSS, m bgl, NDVI.

## 4. Statuses

- "Research only": result is not validated for operational use. Uttar Pradesh telemetry benchmark stays `PROVISIONAL_RESEARCH_RESULT`, `operational_eligibility: false`.
- "Simulated": no external message was sent.
- "Database connected / not connected": describes only whether the blocks API returned data.
- Avoid "live", "verified", "complete", "active" unless the page can state what was checked and when.

## 5. Display rules

- Dates: ISO `YYYY-MM-DD`, always labelled "Observed" or "Ingested".
- Units: always beside the number; never change source units.
- Missing data: "No data" or "—", never zero.
- Uncertainty: show P10–P90 next to the forecast, with research-only note adjacent.
- Source: name the provider next to charts and tables.

## 6. Claims requiring evidence (not asserted)

Irrigation and drinking-water dependence percentages; model superiority; GSS calibration; government partnership or endorsement; operational readiness; privacy guarantees beyond what is observable in code.

## 7. Review triggers

Re-review copy when: a data source or cadence changes; a model version or benchmark changes; GSS weights change; states or blocks are added; alert delivery becomes real.

## 8. Safe-edit rule

Change display text only. Do not alter object keys, enum values (`severe`, `watch`, `RESEARCH_ONLY`), API fields, or translation keys; tests pin several of these.
