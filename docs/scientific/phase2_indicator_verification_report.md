# JalDrishti — Phase 2: Indicator Verification & Authoritative Data Integration Report

## 1. Executive Summary & Verification Classification

This report provides an independent scientific and technical verification of the groundwater indicator pipeline, APIs, UI data-source labeling, and candidate authoritative data sources for JalDrishti's six approved pilot blocks in Bundelkhand (Madhya Pradesh).

### Verification Summary
- **Published Groundwater Observations**: **VERIFIED**. Exactly 305 published rows from batch `a1000000-0000-0000-0000-000000000305` (`src_cgwb_wells`) spanning 34 stations across 6 blocks.
- **Null Measurement Preservation**: **VERIFIED**. Exactly 3 observations have `water_level_mbgl IS NULL`. They remain strictly SQL `NULL` and are not converted to zero in calculation or API serialization.
- **Pilot Block Groundwater Indicators**: **VERIFIED**. Exactly 6 records in `derived_indicators` corresponding to LGD blocks `3783`, `3788`, `4027`, `4028`, `4030`, and `4032`.
- **Reproducibility of Calculation**: **VERIFIED**. Independent recalculation from `v_published_historical_observations` exactly reproduces all 6 block mean depths and OLS regression slopes.
- **Data Period Caveat**: **VERIFIED**. All observations are historical, spanning `2021-01-10` to `2023-08-20`. None represent live 2026 conditions.
- **Rainfall and Satellite Fields**: **VERIFIED**. `grace_twsa_cm`, `rainfall_anomaly_mm`, `spi_3month`, `sentinel_ndvi`, `sentinel_ndwi`, and `smap_soil_moisture` remain strictly `NULL` in the database.
- **API and UI Fallback Gating**: **VERIFIED**. `/api/geospatial/blocks` returns `source: 'live_database'` and 6 blocks. `/api/historical-observations` returns `source: 'historical_database'` and 305 observations without demo fixtures.

---

## 2. Scientific Verification of Groundwater Indicators

### Pilot Block Verification Matrix

| LGD Unit ID | Block Name | District Name | Selected Date | Stations Count | Valid Obs / Total Obs | Mean Depth (`m bgl`) | OLS Trend (`m/yr`) | Trend Direction | Descriptive Score | Risk Severity | Recalculation Audit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `3783` | BIJAWAR | CHHATARPUR | 2023-08-20 | 8 | 72 / 73 | **7.47** | **-0.047** | Recharge / Stable | 50 | `watch` | **100% Match** |
| `3788` | RAJNAGAR | CHHATARPUR | 2023-08-20 | 8 | 74 / 74 | **4.39** | **-0.315** | Water table rise | 29 | `normal` | **100% Match** |
| `4027` | BALDEOGARH | TIKAMGARH | 2023-08-20 | 2 | 20 / 20 | **1.23** | **-0.661** | Water table rise | 8 | `normal` | **100% Match** |
| `4028` | JATARA | TIKAMGARH | 2023-08-20 | 7 | 67 / 67 | **3.90** | **-0.360** | Water table rise | 26 | `normal` | **100% Match** |
| `4030` | PALERA | TIKAMGARH | 2023-05-20* | 2 | 14 / 15 | **4.83** | **-1.179** | Water table rise | 32 | `normal` | **100% Match** |
| `4032` | TIKAMGARH | TIKAMGARH | 2023-08-20 | 7 | 55 / 56 | **5.96** | **+0.152** | Drawdown decline | 40 | `normal` | **100% Match** |

### Scientific Audit of Specific Findings

#### 1. Bijawar (`3783`) "Watch" Severity & Threshold Audit
- **Observation**: Bijawar is classified as `watch` with a score of 50, whereas all other blocks are `normal`.
- **Audit**:
  - Bijawar's mean depth on `2023-08-20` is **7.47 m bgl**, exceeding the threshold of **7.0 m bgl**.
  - Its OLS slope is $-0.047\text{ m/yr}$ (essentially stable with slight recovery).
  - *Hydrogeological Evaluation*: In hard-rock crystalline Bundelkhand aquifers (granites/gneisses of the Bundelkhand Gneissic Complex), a post-monsoon depth of 7.47 m bgl indicates deeper pre-monsoon drawdown and limited fractured-zone thickness compared to shallow alluvial floodplains. However, the 7.0 m bgl threshold is a heuristic policy threshold, not a calibrated dynamic threshold.
  - *Recommendation*: Preserve `watch` in this prototype release as documented in the specification, but add an explicit caveat that this severity is a descriptive heuristic benchmark, not a statutory CGWB groundwater assessment categorization (such as 'Over-Exploited' or 'Critical' under GEC-2015 methodology).

#### 2. Palera (`4030`) Date-Selection Exception
- **Observation**: Palera's `assessed_date` is `2023-05-20`, whereas the other five blocks use `2023-08-20`.
- **Audit**:
  - On `2023-08-20`, Palera had exactly 1 observation recorded: station `CGWB_MP_Bamori1` with `water_level_mbgl = NULL` (missing reading).
  - Rather than fabricating a $0.0\text{ m bgl}$ reading or failing with NaN, the calculation service adhered to specification rule §4: it fell back to the immediately preceding campaign with valid observed measurements (`2023-05-20`), where 2 stations reported valid readings averaging **4.83 m bgl**.
  - *Verdict*: Fully compliant with missing-data rules. The UI and database correctly record `assessed_date: '2023-05-20'`, preventing false post-monsoon claims for Palera.

#### 3. Trend Direction & Physical Units
- **Convention**: $\text{m bgl}$ measures distance downward from surface.
- A positive slope ($+0.152\text{ m/yr}$ in Tikamgarh block) represents deepening water levels (aquifer depletion / drawdown).
- A negative slope ($-0.047$ to $-1.179\text{ m/yr}$) represents rising water levels towards the surface (recharge / recovery).
- Both the specification and UI explanations adhere to this physical convention.

---

## 3. Authoritative Data Source Readiness Matrix

| Indicator | Source & Official Product | Access Mechanism | Coverage Verified | Native & Target Resolution | Processing Required | Scientific Validation & Constraints | Implementation Recommendation |
|---|---|---|---|---|---|---|---|
| **Precipitation & Rain Anomaly** | IMD High-Resolution Daily Gridded Rainfall (0.25° × 0.25°) | IMD Data Supply Portal / National Data Sharing & Accessibility Policy (NDSAP). Manual bulk request or staged NetCDF/ASCII grid. | 1901–present (Long Period Average 1991–2020) | Native: 0.25° (~25km), Daily. Target: Block spatial average, mm/month. | Spatial clipping to block polygon, area-weighted mean of intersecting grid cells, subtraction of 30-year monthly climatology. | High credibility (national official standard). 25km resolution spans multiple blocks in Bundelkhand; requires area-weighted interpolation. | **Stage Staged NetCDF/CSV Files First**. Real-time API unavailable without institutional credentials. |
| **3-Month Standardized Precipitation Index (SPI-3)** | IMD Gridded Rainfall Derived Product | Derived from IMD gridded daily/monthly rainfall time series. | Minimum 30 continuous years required for two-parameter Gamma distribution fitting. | Native: 0.25°, Monthly. Target: Dimensionless standardized index. | Monthly precipitation accumulation over 3 months, Gamma distribution parameter estimation (shape $\alpha$, scale $\beta$), cumulative probability transformation to standard normal $Z$. | Cannot be calculated from 2021–2023 observations alone. Requires full 30-year historical baseline (1991–2020) to avoid distribution distortion. | **Stage Pre-Calculated IMD District/Grid SPI**, or compute offline using historical 30-year IMD grids. Do not calculate on the fly from small sample. |
| **Terrestrial Water Storage Anomaly (TWSA)** | NASA GRACE / GRACE-FO Tellus RL06.1 Mascon Solution | NASA PO.DAAC / Earthdata Cloud Open Access (HTTPS / S3 API). | 2002–present (~2 month lag, 11-month data gap 2017–2018). | Native: 3° spherical harmonic / 0.5° or 1.0° mascon grid. Target: cm equivalent water height. | Spatial clipping to regional Bundelkhand basin (Ken-Betwa river basin), anomaly relative to 2004–2010 mean. | **Critical Scale Mismatch**: GRACE spatial resolution (~100,000 km²) is 50–100× larger than an individual block (~500–1,000 km²). Downscaling without local hydrological model introduces false precision. | **Regional Context Only**. Must be displayed as regional Bundelkhand/basin-level indicator, never village-level depth. |
| **Vegetation Health (NDVI)** | Copernicus Sentinel-2 MSI Level-2A (Bottom-of-Atmosphere) | ESA Copernicus Data Space Ecosystem (CDSE) Open Access API (OData / STAC). | 2015–present (5-day revisit). | Native: 10m bands (B4 Red, B8 NIR). Target: 10m raster / Block median NDVI. | Scene filtering, SCL (Scene Classification Layer) cloud/shadow masking, normalized difference $(B8-B4)/(B8+B4)$, 15-day maximum value composite (MVC). | Highly suited for agricultural stress and drought monitoring. Monsoonal cloud cover causes data gaps between July–September in Bundelkhand. | **Integrate via STAC / Pre-processed MVC Composites**. Feasible for automated pipeline. |
| **Surface Water Index (NDWI)** | Copernicus Sentinel-2 MSI Level-2A (Bottom-of-Atmosphere) | ESA Copernicus Data Space Ecosystem (CDSE) Open Access API. | 2015–present (5-day revisit). | Native: 10m/20m bands (B3 Green, B8 NIR / B11 SWIR). Target: Block surface water area (ha). | SCL masking, Gao/McFeeters ratio $(B3-B8)/(B3+B8)$, Otsu thresholding for open surface water bodies (tanks, check dams). | Direct evidence of traditional Bundelkhand water bodies (Chandela and Bundela tanks). Seasonal drying is normal; requires comparison against post-monsoon baseline. | **Integrate alongside Sentinel-2 NDVI pipeline**. Staged satellite tiles recommended. |
| **Surface Soil Moisture** | NASA SMAP L3 Radiometer Global Daily 9km (SPL3SMP) | NASA NSIDC DAAC / Earthdata Cloud. | 2015–present (1–3 day repeat). | Native: 9km cylindrical equal-area grid. Target: $m^3/m^3$ volumetric soil moisture. | Spatial extraction, quality flag filtering (freeze/thaw, heavy vegetation, radio interference). | Measures top 5 cm of soil only. Does not reflect deep hard-rock aquifer water table. Useful as infiltration/runoff proxy. | **Defer**. 9km resolution provides ~1–2 grid points per block. Subordinate to rainfall and well levels. |

---

## 4. Architectural Integration Pipeline Design

### Modular Architecture Structure

```
src/
├── lib/
│   ├── adapters/                        <-- Source Ingestion Adapters
│   │   ├── baseAdapter.ts               <-- Shared adapter interface & checksum verification
│   │   ├── imdRainfallAdapter.ts        <-- IMD Gridded Rainfall Parser (NetCDF/CSV)
│   │   ├── sentinelIndicesAdapter.ts    <-- Sentinel-2 STAC/GeoTIFF Index Processor
│   │   └── cgwbWellsAdapter.ts          <-- CGWB National Groundwater Portal Adapter
│   ├── processors/                      <-- Preprocessing & Spatial Aggregation
│   │   ├── spatialAggregator.ts         <-- Polygon intersection & area-weighted mean
│   │   ├── spiCalculator.ts             <-- 30-year Gamma fitting & SPI-3 transformation
│   │   └── indicatorAggregator.ts       <-- Deterministic Derived Indicator Assembler
│   ├── provenance/                      <-- Data Lineage & Telemetry
│   │   └── auditLedger.ts               <-- Checksums, run logs, operator signatures
```

### Key Architectural Safeguards
1. **Source Immutability**: All ingested files stored with cryptographic SHA-256 digests in `observation_ingestion_batches`.
2. **Strict Spatial Separation**: Coarse products (GRACE at 1.0°, IMD at 0.25°) are labeled with native spatial resolution and never interpolated to false point precision.
3. **Fail-Closed Missing Data Contract**: If a parameter cannot be computed with sufficient coverage, it must remain `NULL`. The UI must render transparent "Data Gap / Unmeasured" cards rather than default zeros.
4. **Offline Staging Precedence**: Because government APIs (IMD, India-WRIS) lack authenticated public REST streaming, data ingestion must support deterministic offline staging with checksum verification.

---

## 5. Test and Build Execution Results

### Automated Test Suite Execution
- **Command**: `node --experimental-strip-types --test tests/*.test.ts`
- **Result**: **111 passed**, **0 failed** across all 18 test suites in 382ms.
- **Coverage**:
  - `indicatorCalculationService.test.ts`: 4/4 passed (mean depth, OLS slope, null preservation, boundary gap).
  - `dualModeDataSystem.test.ts`: 8/8 passed (fallback gating, fail-closed historical API, data isolation).
  - `geospatialService.test.ts`: 8/8 passed (source classification, null preservation).
  - `scientificEngine.test.ts`: 5/5 passed (GSS calculation, null handling, intervention rules).
  - All existing routing, mapping, language, and governance tests remain 100% green.

### Production Build Execution
- **Command**: `npm run build`
- **Result**: **Clean compilation** (`next build`, 5.1s).
- **Route Matrix**: All 11 static and dynamic routes compiled without lint or type errors.
- **Bundle Footprint**: 103 kB shared JS across all routes. Zero service-role credentials in client bundles.

---

## 6. Remaining Blockers & Next Action

### Ranked Blocker Matrix
1. **Priority 1 (Data Acquisition)**: IMD gridded daily rainfall data (1991–2023) for Bundelkhand is not yet staged in the repository. Without this baseline file, genuine rainfall anomalies and SPI-3 cannot be computed and must remain NULL.
2. **Priority 2 (Spatial Boundaries)**: Full official PostGIS polygon geometries for the 6 pilot blocks in `administrative_units.geom` are currently NULL (only centroid coordinates are stored). Area-weighted raster zonal statistics require full polygon boundaries.
3. **Priority 3 (Environment / Visual Automation)**: Local Playwright browser driver binaries are unavailable on Windows due to external upstream CDN 404, preventing headless browser screenshotting. Server HTTP responses and SSR markup verification remain deterministic and fully verified.

### Single Next Implementation Step
- **Action**: Implement the `imdRainfallAdapter` contract and stage the verified Madhya Pradesh gridded precipitation baseline dataset to compute genuine rainfall anomalies and SPI-3 for the six pilot blocks.
