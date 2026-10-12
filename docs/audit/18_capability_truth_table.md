# JalDrishti — Phase Eighteen: Capability & Data Truth Table

**Verification Date:** October 12, 2026  
**Standards:** Direct source code inspection, test results (`npm test`), build output (`npm run build`).

| Capability / Module | Exists in Code | Connected to UI | Uses Real Data | Runtime Verified | Scientifically Validated | Production Ready | Evidence Path / Notes | Current Limitation / Gap |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Main Dashboard (`/`)** | TRUE | TRUE | PARTIAL | TRUE | PARTIAL | NO | [`src/app/page.tsx`](file:///D:/Projects/JalDrishti/src/app/page.tsx) | District/Block filtering operates over local fixtures (`bundelkhand.ts`). |
| **Geospatial Map Explorer (`/explorer`)** | TRUE | TRUE | PARTIAL | TRUE | PARTIAL | NO | [`src/components/MapExplorer.tsx`](file:///D:/Projects/JalDrishti/src/components/MapExplorer.tsx) | Renders Leaflet polygons and well locations; boundary file is SOI 2025 Tehsil polygons. |
| **Multi-Indicator Monitoring (`/monitoring`)** | TRUE | TRUE | FALSE | TRUE | FALSE | NO | [`src/app/monitoring/page.tsx`](file:///D:/Projects/JalDrishti/src/app/monitoring/page.tsx) | Recharts plots dual-axis time-series using pre-calculated static sample points. |
| **Groundwater Stress Score (`/risk-assessment`)** | TRUE | TRUE | FALSE | TRUE | FALSE | NO | [`src/app/risk-assessment/page.tsx`](file:///D:/Projects/JalDrishti/src/app/risk-assessment/page.tsx) | GSS is a heuristic weighted score; not calibrated against held-out hydrogeology. |
| **Interventions & Schemes (`/interventions`)** | TRUE | TRUE | FALSE | TRUE | FALSE | NO | [`src/app/interventions/page.tsx`](file:///D:/Projects/JalDrishti/src/app/interventions/page.tsx) | Catalogs PMKSY, MGNREGA schemes; proposals store in local React state, not Postgres. |
| **Hindi Advisory Engine (`/alerts`)** | TRUE | TRUE | FALSE | TRUE | FALSE | NO | [`src/app/alerts/page.tsx`](file:///D:/Projects/JalDrishti/src/app/alerts/page.tsx) | Templates adhere to Safe Wording Policy; dispatches are simulated without SMS gateway. |
| **Data Sources Monitor (`/data-sources`)** | TRUE | TRUE | PARTIAL | TRUE | PARTIAL | NO | [`src/app/data-sources/page.tsx`](file:///D:/Projects/JalDrishti/src/app/data-sources/page.tsx) | Displays telemetry status; reflects hardcoded mock metadata rather than live worker pings. |
| **Historical Observations API** | TRUE | PARTIAL | TRUE | TRUE | TRUE | PARTIAL | [`src/app/api/historical-observations/route.ts`](file:///D:/Projects/JalDrishti/src/app/api/historical-observations/route.ts) | Queries `v_published_historical_observations`; returns 503 if view unmigrated on remote DB. |
| **Geospatial Blocks API** | TRUE | TRUE | PARTIAL | TRUE | PARTIAL | NO | [`src/app/api/geospatial/blocks/route.ts`](file:///D:/Projects/JalDrishti/src/app/api/geospatial/blocks/route.ts) | Attempts DB fetch, gracefully falls back to `ALL_BLOCKS` on remote 42501 error. |
| **CGWB Observation Pipeline** | TRUE | FALSE | TRUE | TRUE | TRUE | PARTIAL | [`src/lib/services/cgwbAdapter.ts`](file:///D:/Projects/JalDrishti/src/lib/services/cgwbAdapter.ts) | CSV parsing and coordinate bounds tested; batch staging not exposed in admin UI. |
| **IMD Rainfall Ingestion** | TRUE | FALSE | PARTIAL | TRUE | TRUE | PARTIAL | [`src/lib/adapters/imdRainfallAdapter.ts`](file:///D:/Projects/JalDrishti/src/lib/adapters/imdRainfallAdapter.ts) | NetCDF parser and SPI-3 calculation verified; automated FTP/HTTP downloader missing. |
| **GRACE TWSA Ingestion** | FALSE | FALSE | FALSE | FALSE | FALSE | NO | None (referenced in docs) | Only mock columns exist; no automated NetCDF ingestion pipeline for JPL Tellus grids. |
| **Sentinel-2 NDVI / NDWI** | FALSE | FALSE | FALSE | FALSE | FALSE | NO | None (referenced in docs) | Configured in schema/mock data; no Google Earth Engine / Copernicus API worker. |
| **SMAP Soil Moisture** | FALSE | FALSE | FALSE | FALSE | FALSE | NO | None (referenced in docs) | Configured in schema/mock data; no NASA Earthdata ingestion pipeline. |
| **Predictive AI / LSTM Forecasting** | FALSE | FALSE | FALSE | FALSE | FALSE | NO | None | No neural network weights, PyTorch/ONNX runtime, or training scripts exist in repo. |
| **PostgreSQL RLS Security** | TRUE | TRUE | N/A | PARTIAL | N/A | NO | [`supabase/migrations/`](file:///D:/Projects/JalDrishti/supabase/migrations/) | Migration `20261011000002` written and tested locally, but pending remote application. |
| **Multi-Language (Hindi/English)** | TRUE | TRUE | N/A | TRUE | N/A | YES | [`src/lib/context/LanguageContext.tsx`](file:///D:/Projects/JalDrishti/src/lib/context/LanguageContext.tsx) | Verified context toggle covers header, cards, navigation, and advisory templates. |
| **Responsive Mobile Layout** | TRUE | TRUE | N/A | TRUE | N/A | YES | [`src/components/Navigation.tsx`](file:///D:/Projects/JalDrishti/src/components/Navigation.tsx) | Clean mobile navigation bar, flexible grid layouts, accessible touch targets. |
