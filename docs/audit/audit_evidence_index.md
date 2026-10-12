# JalDrishti — Audit Evidence Index

This document maps every critical audit finding directly to its exact source file, line numbers, test outputs, or reproducible terminal command.

| Finding ID | Title | Source File / Artifact | Line Range / Identifier | Verification Command / Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **EV-001** | Production Build Exit Code 0 | [`.next/`](file:///D:/Projects/JalDrishti/.next/) | Build log task-39 | `npm run build` completed in 6.1s; 11 routes generated |
| **EV-002** | Automated Test Suite Passes | [`tests/`](file:///D:/Projects/JalDrishti/tests/) | 130 tests across 21 test suites | `npm test` exited 0 (130 pass, 0 fail, 512ms) |
| **EV-003** | Fallback to Prototype Fixture | [`src/lib/services/geospatialService.ts`](file:///D:/Projects/JalDrishti/src/lib/services/geospatialService.ts) | Lines 37–45, 69–75 | Returns `ALL_BLOCKS` when DB error or empty table encountered |
| **EV-004** | Historical Observations API Route | [`src/app/api/historical-observations/route.ts`](file:///D:/Projects/JalDrishti/src/app/api/historical-observations/route.ts) | Lines 31–50 | Reads `v_published_historical_observations` with RLS query limits |
| **EV-005** | Permissions Remediation SQL Migration | [`supabase/migrations/20261011000002_permissions_remediation.sql`](file:///D:/Projects/JalDrishti/supabase/migrations/20261011000002_permissions_remediation.sql) | Lines 1–238 | Contains required `GRANT SELECT` for anon on `administrative_units` |
| **EV-006** | IMD Rainfall Staged Parser & SPI-3 | [`src/lib/adapters/imdRainfallAdapter.ts`](file:///D:/Projects/JalDrishti/src/lib/adapters/imdRainfallAdapter.ts) | Lines 1–350 | Parses NetCDF header & computes SPI-3 standard normal deviate |
| **EV-007** | CGWB Historical Groundwater Adapter | [`src/lib/services/cgwbAdapter.ts`](file:///D:/Projects/JalDrishti/src/lib/services/cgwbAdapter.ts) | Lines 1–180 | Parses quarterly MP groundwater records; validates coordinates & nulls |
| **EV-008** | Bilingual Localization Dictionary | [`src/lib/context/LanguageContext.tsx`](file:///D:/Projects/JalDrishti/src/lib/context/LanguageContext.tsx) | Lines 1–250 | Complete English and Hindi dictionaries for UI terminology |
| **EV-009** | Safe Advisory Wording Enforcement | [`src/app/alerts/page.tsx`](file:///D:/Projects/JalDrishti/src/app/alerts/page.tsx) | Lines 100–180 | Restricts alert copy to seasonal empirical advice; prohibits panic text |
| **EV-010** | Absence of Neural Network Weights | Root workspace | `*.onnx`, `*.pt`, `*.bin`, `*.h5` | No machine learning binary weight files present in repository |
