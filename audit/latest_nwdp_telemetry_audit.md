# Current NWDP telemetry audit — 2026-10-25

Generated from ingestion manifest `2026-10-24T23:20:22.994590+00:00`, canonical registry `2026-10-24T23:20:22.994590+00:00`, current mapping evidence, block series, and captured verification evidence.

## Evidence status

- Production build: **UNVERIFIED** (`npm run build`, exit 0); typecheck is not substituted for a build.
- Local HTTP smoke: **UNVERIFIED**; see `latest_telemetry_verification_evidence.json` for request/status/source/count details.
- Raw lineage: **VERIFIED**; source files/hashes and record IDs are checked separately from measurement validity.
- Trusted NWDP observations: 0; no verified station mapping or station-specific measurement convention/calibration.
- Readiness: 43 canonical rows, 0 operational; freshness policy remains 400 days.

## Regression and project checks

| Check | Exit | Result |
|---|---:|---|
| `npx tsc --noEmit` | 0 | TypeScript check |
| `npm test` | 0 | 250 passed; 0 failed; 5 skipped |
| Focused JavaScript | 0 | 14 passed |
| Focused Python telemetry/audit | 0 | 22 passed |
| Full Python suite | 1 | 97 passed; 26 failed; see blockers below |

## Captured API response evidence

| Request | HTTP | Response source | Block | Count / total | Record evidence |
|---|---:|---|---|---:|---|
| `/api/historical-observations?limit=1` | 200 | historical_database | 3783 | 1 / 9595 | 2025-11-15 — 8.65 metre below ground level; station DWLR_MP_Badamalera; quality passed |
| `/api/historical-observations?block=blk_karnal_assandh&limit=5` | 200 | historical_database | blk_karnal_assandh | 0 / 0 | fallback: unverified |
| `/api/historical-observations?block=blk_karnal_assandh&from=bad-date` | 400 | — | blk_karnal_assandh | None / — | error: from and to must use YYYY-MM-DD |

The unfiltered database sample carries a provenance inconsistency: `source_name` describes NWIC DWLR telemetry, while `source_resource_url` names a CGWB manual quarterly CSV. The raw file is not present locally to resolve the discrepancy. `quality_flag=passed` is preserved as a database field, not treated as independent verification. Supabase error and local-fallback branches were exercised in automated source-selection tests, not forced against the live remote service.

## Mutually exclusive raw-row reconciliation

| Exclusive class | Rows |
|---|---:|
| Negative, unconverted and unverified | 10617901 |
| Exact zero, retained candidate | 2487 |
| Exact one, retained candidate | 128268 |
| Other positive candidate values (current candidate range, excluding exact one/fault/sentinel) | 411922 |
| Sentinel-like parser patterns, retained pending station QC | 18 |
| Positive readings above 150, pending review | 7319 |
| Invalid timestamps | 0 |
| Missing measurements | 0 |
| Malformed/nonfinite measurements | 0 |
| **Total source records / exclusive classes** | **11167915 / 11167915** |

Candidate total = zero + exact-one + other positive candidates + sentinel-like values pending station QC = 542695; quarantine total = negative + >150 + invalid/missing/malformed = 10625220. Sentinel-like means only the parser's configured numeric pattern set; no station-specific evidence confirms those values are fault codes. Positive numeric readings (547527) are a non-exclusive sign diagnostic, not a validation total.

## 2026-2030 resource-file filter (not calendar-year filter)

Filter: include the nine manifest resources whose period is exactly `2026-2030`; count all physical non-empty CSV source rows in those files. Candidate definition remains zero/exact-one/other positive candidate under the current ingestion rules; quarantine remains the exclusive remainder.

| State | Source file | Rows | Positive numeric | Zero | Exact one | Other positive candidate | >150 | Candidate | Quarantined |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Haryana | `gwl_tel_6_hourly_cgwb_hr_2026_2030.csv` | 5476 | 5475 | 1 | 0 | 5475 | 0 | 5476 | 0 |
| Karnataka | `gwl_tel_6_hourly_cgwb_ka_2026_2030.csv` | 239382 | 17614 | 24 | 4678 | 12936 | 0 | 17638 | 221744 |
| Madhya Pradesh | `gwl_tel_6_hourly_cgwb_mp_2026_2030.csv` | 309082 | 10470 | 18 | 4862 | 5606 | 2 | 10486 | 298596 |
| Meghalaya | `gwl_tel_6_hourly_cgwb_ml_2026_2030.csv` | 9718 | 417 | 0 | 417 | 0 | 0 | 417 | 9301 |
| Punjab | `gwl_tel_6_hourly_cgwb_pb_2026_2030.csv` | 36645 | 36641 | 2 | 0 | 36640 | 1 | 36642 | 3 |
| Rajasthan | `gwl_tel_6_hourly_cgwb_rj_2026_2030.csv` | 371633 | 21553 | 12 | 15537 | 5700 | 316 | 21249 | 350384 |
| Tamil Nadu | `gwl_tel_6_hourly_cgwb_tn_2026_2030.csv` | 674156 | 15788 | 112 | 4295 | 11492 | 1 | 15899 | 658257 |
| Telangana | `gwl_tel_6_hourly_cgwb_ts_2026_2030.csv` | 536630 | 24297 | 12 | 7541 | 16756 | 0 | 24309 | 512321 |
| Tripura | `gwl_tel_6_hourly_cgwb_tr_2026_2030.csv` | 4880 | 1 | 0 | 1 | 0 | 0 | 1 | 4879 |
| **Total** | **9 files** | **2187602** | **132256** | **181** | **37331** | **94605** | **320** | **132117** | **2055485** |

The historical 94,925 and 106,733 candidate claims are **UNVERIFIED and unreproducible**: the prior artifacts/filter definitions are absent. The historical 85,348 zero/one claim is not current; the current full-source zero-plus-one count is 130,755. The current 132,256 figure is only the raw positive-numeric diagnostic for the nine 2026-2030 files; current candidates are 132,117 and other positive candidates are 94,605. None of these are verified depths.

## Remaining blockers

- **BLOCKED — station mapping:** official station coordinate/CRS and authoritative block-containment evidence remain absent, including ChocftraPz, Bapi_Pz_1, TIGARIA_1, and UTHANDI_1. Their candidates stay unassigned.
- **BLOCKED — measurement semantics:** station-specific sign convention, datum, installation depth and calibration are not documented. Negative values are not converted; zero/one remain candidates pending station-specific QC.
- **FAILED — full Python suite:** exit 1, 26 failures / 97 passes. Failures include missing CGWB Ingres and UP source/artifact fixtures, obsolete 56-block assertions, and the model HTTP-serving test. No deleted inputs were restored or fabricated.
- **UNVERIFIED — Supabase row lineage:** one live row is labelled NWIC telemetry while its source URL names a manual quarterly CGWB CSV; the source file is absent locally. `quality_flag=passed` does not resolve this provenance conflict.
- **UNVERIFIED — remote error branch:** database error and fallback decisions pass focused tests, but a live Supabase error was not forced. Local smoke showed the empty Supabase result and the published-result branch.

## Discrepancy register

| Prior claim | Current evidence / root cause | Correction | Status |
|---|---|---|---|
| Typecheck implied production build ready | A TypeScript command is not a build result; current run has explicit `npm run build` exit 0 and Next output in the evidence file. | Generator accepts only explicit build command + exit 0 + build output marker; no inference from tsc/dev startup. | FIXED / current build VERIFIED |
| API commands implied endpoint verification | Command history alone omits status/body/source/count. | Captured local production HTTP responses, including empty block result, invalid-parameter errors, and database result metadata. | FIXED / live smoke VERIFIED |
| Section 7 per-block hundreds of observations | The cited legacy matrix source is not present in the current checkout; the older generator expects `audit/canonical_43_telemetry_verification_matrix.json`, which is absent. It cannot be determined whether those counts came from manual CGWB/State GWD data, unverified telemetry, or a prior fuzzy crosswalk. Current canonical registry plus mapping and series artifacts yield zero trusted NWDP rows. | Rebuild readiness only from canonical IDs, current mapping evidence, and actual trusted series; candidates remain unassigned. | Historical counts UNVERIFIED; current matrix regenerated |
| Raw class arithmetic and candidate/quarantine totals | Positive sign-only diagnostic overlaps exact one, sentinel-like patterns, and >150; sentinel patterns were not station-documented fault codes. | Preserve sentinel-like readings as unverified candidates; publish exclusive partition and abort report generation on mismatch. | FIXED / VERIFIED |
| 94,925 / 106,733 old 2026 totals | Previous artifacts and filter definitions unavailable. Current period files independently report 132,256 positive numeric, 132,117 candidates, and 94,605 other positives. | Publish file-period filter and categories; do not carry old totals forward. | Historical claims UNVERIFIED |
| 85,348 zero/one readings pending QC | Current raw partition counts 2487 zeros + 128268 exact ones; no artifact explains the old total. | Use current source reconciliation only; retain zero/one as unverified candidates. | Historical claim UNVERIFIED |
| Negative readings are submerged pressure/head | Source metadata does not establish station-level sign convention/datum/calibration. | Wording changed to unresolved; negatives stay quarantined and benchmark no longer takes absolute values. | FIXED |
| Lineage proves measurement validity | Lineage identity/hash traces inputs but says nothing about calibration or block membership. | Report lineage integrity and scientific verification as separate statuses. | VERIFIED / fail-closed |
| NWDP/NWIC labelled CGWB archive | NWDP source is not a CGWB archive; old label was unsupported. | Local API fallback label remains `local_processed_observation_archive`; Supabase source label is separately reported. | FIXED |
| Live Supabase row provenance is internally inconsistent | Captured row has source_name `National Water Data Portal (NWIC) DWLR Telemetry Network` but its resource URL filename is `gwl_manual_quarterly_cgwb_mp_2021_2025.csv`; the file is absent locally. `quality_flag=passed` is database metadata, not independent verification. | Preserve the returned record/fields; mark its source lineage unresolved and do not treat it as verified NWDP telemetry. | UNVERIFIED |

See `nwdp_43_block_readiness.md` for the complete 43-block table. The historical reading numbers are never used as current verified observations.
