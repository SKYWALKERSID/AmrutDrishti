# JalDrishti — Phase 3: IMD Rainfall Data Integration Report

## 1. Executive Summary

This report establishes the implementation and verification of the **India Meteorological Department (IMD) Gridded Rainfall Data Integration Pipeline** for JalDrishti's pilot area in Tikamgarh and Chhatarpur districts (Madhya Pradesh).

In accordance with strict scientific and database integrity guidelines:
- **No speculative or synthetic database writes were executed**. The live Supabase database remains untouched; production `rainfall_anomaly_mm` and `spi_3month` in `public.derived_indicators` remain explicitly `NULL`.
- **A fully reproducible, modular IMD adapter** was built at [src/lib/adapters/imdRainfallAdapter.ts](file:///d:/Projects/JalDrishti/src/lib/adapters/imdRainfallAdapter.ts).
- **Pure, mathematically rigorous rainfall calculation services** (rainfall anomaly and SPI-3 via Wilson-Hilferty Gamma transformation) were implemented at [src/lib/services/rainfallCalculationService.ts](file:///d:/Projects/JalDrishti/src/lib/services/rainfallCalculationService.ts).
- **Comprehensive automated tests** were added at [tests/imdRainfallIntegration.test.ts](file:///d:/Projects/JalDrishti/tests/imdRainfallIntegration.test.ts), bringing the repository test suite to **121 passing tests (0 failures)**.
- **Production build compiled cleanly** with zero type or lint errors.

---

## 2. IMD Source-Readiness Assessment & Data Contracts

### 2.1 Authoritative Source Characteristics
- **Provider**: India Meteorological Department (IMD Pune, Climate Research and Services).
- **Product**: Daily High-Resolution Gridded Rainfall ($0.25^\circ \times 0.25^\circ$ spatial grid, approximately $25\text{ km} \times 25\text{ km}$).
- **Coordinate Reference System**: EPSG:4326 (WGS 84 latitude/longitude).
- **Native Spatial Bounds**: Indian landmass ($6.5^\circ\text{N} - 38.5^\circ\text{N}$, $66.5^\circ\text{E} - 100.0^\circ\text{E}$).
- **Access Constraint**: IMD gridded daily data is distributed via the IMD Data Supply Portal and the Open Government Data Platform India (NDSAP) under formal application or bulk download. **There is no public, unauthenticated streaming REST API**.
- **Staging Interface**: Because automated live downloads are unavailable, JalDrishti implements a deterministic **Staged-File Architecture** utilizing cryptographic SHA-256 digests and formal manifest headers (`# MANIFEST: {...}`).

### 2.2 Staged-File Input Contract
Staged rainfall files must adhere to the following schema:
```csv
# MANIFEST: {"datasetName":"IMD High-Resolution Daily Gridded Rainfall (0.25 x 0.25)","provider":"India Meteorological Department (IMD Pune)","version":"v2023.1","spatialResolution":"0.25 degree (~25km)","coordinateReferenceSystem":"EPSG:4326","baselinePeriod":"1991-2020","retrievalDate":"2026-10-11","checksumSha256":"<sha256>","licensingTerms":"Government of India Open Data Policy (NDSAP)"}
date,latitude,longitude,rainfall_mm,quality_flag
2023-06-01,24.7500,78.7500,0.0,passed
2023-06-02,24.7500,78.7500,12.4,passed
2023-06-03,24.7500,78.7500,null,missing
```

---

## 3. Mathematical & Scientific Methodology

### 3.1 Rainfall Anomaly
$$\text{Anomaly (mm)} = P_{\text{observed}} - \bar{P}_{\text{climatological}}$$
$$\text{Anomaly (\%)} = \left(\frac{P_{\text{observed}} - \bar{P}_{\text{climatological}}}{\bar{P}_{\text{climatological}}}\right) \times 100$$
- **Baseline Window**: Explicitly set to the official WMO/IMD standard 30-year climatological normal (`1991–2020`).
- **Null Safety**: If either observed precipitation or the baseline climatological normal is unavailable, returns `isDataGap = true` and `anomaly = NULL`. Never converts nulls to zero.

### 3.2 3-Month Standardized Precipitation Index (SPI-3)
- **Minimum Data Requirement**: Requires a continuous historical baseline of $\ge 20$ years (ideally 30 years). If fewer than 20 years are provided, calculation returns an explicit status `insufficient_baseline` with `spi = NULL`.
- **Distribution Fitting**: Fits a two-parameter Gamma distribution with shape parameter $\alpha$ and scale parameter $\beta$ using Thom's maximum likelihood approximation over non-zero observations.
- **Zero-Precipitation Handling**: Calculates cumulative probability $H(x) = q + (1 - q) G(x)$, where $q$ is the empirical probability of zero precipitation.
- **Transformation**: Uses the Wilson-Hilferty cube-root transformation to convert Gamma cumulative probabilities into a standard normal variate $Z \sim \mathcal{N}(0, 1)$, bounded strictly within $[-4.0, +4.0]$:
  $$Z = 3\sqrt{\alpha} \left[\left(\frac{x / \beta}{\alpha}\right)^{1/3} - 1 + \frac{1}{9\alpha}\right]$$
- **WMO Classification**: Outputs standard descriptors (`Extremely Wet`, `Very Wet`, `Near Normal`, `Moderate Drought`, `Severe Drought`, `Extreme Drought`).

---

## 4. Missing Prerequisites & Spatial Boundary Limitations

### 4.1 Absence of Polygon Geometries (`geom IS NULL`)
An audit of `public.administrative_units` confirms:
- The 6 pilot blocks have valid point centroids in `coordinates` (`POINT` geometry in EPSG:4326).
- However, `administrative_units.geom` is strictly **NULL** for all 6 blocks and 2 districts.
- *Scientific Implication*: Gridded rainfall has a cell dimension of $25\text{ km} \times 25\text{ km}$ ($0.25^\circ$), which exceeds the geographic footprint of small block sub-divisions. Computing true area-weighted zonal statistics across intersecting grid cells requires authoritative multi-polygon boundary shapes.
- *Operational Stance*: In accordance with scientific integrity guidelines, block-level area-weighted aggregation is **not claimed as operational** until authoritative GeoJSON / Shapefile polygons are staged into `administrative_units.geom`.

### 4.2 Production Indicator Isolation
To prevent corrupting the verified groundwater baseline:
- No writes were made to `public.derived_indicators`.
- `rainfall_anomaly_mm` and `spi_3month` remain `NULL` in the database.
- The UI maintains honest data-gap notices for unmeasured meteorological parameters.

---

## 5. Verification Evidence & Test Results

### 5.1 Test Suite Output
```text
node --experimental-strip-types --test tests/*.test.ts
✔ tests 121
✔ suites 0
✔ pass 121
✔ fail 0
✔ duration_ms ~342ms
```
Newly added tests in [tests/imdRainfallIntegration.test.ts](file:///d:/Projects/JalDrishti/tests/imdRainfallIntegration.test.ts):
- `Rainfall Calculations: ISO Date validation works strictly` (Passed)
- `Rainfall Calculations: Rainfall Anomaly calculates millimeter and percentage correctly` (Passed)
- `Rainfall Calculations: Rainfall Anomaly preserves nulls and rejects negative inputs` (Passed)
- `Rainfall Calculations: SPI-3 flags insufficient historical baseline (<20 years)` (Passed)
- `Rainfall Calculations: SPI-3 handles missing current observation safely` (Passed)
- `Rainfall Calculations: SPI-3 computes valid standard normal deviate against 30-year baseline` (Passed)
- `Rainfall Calculations: SPI categories match WMO guidelines` (Passed)
- `IMD Adapter: Validates staged sample file correctly` (Passed)
- `IMD Adapter: Rejects malformed rows and out-of-bound coordinates` (Passed)
- `IMD Adapter: Monthly aggregation handles missing daily observations` (Passed)

### 5.2 Production Build Output
```text
npm run build
✓ Compiled successfully in 5.8s
✓ Generating static pages (11/11)
Finalizing page optimization ...
Collecting build traces ...
```

---

## 6. Actionable Next Steps

1. **Stage Authoritative Boundary Polygons**: Stage official Survey of India / LGD GeoJSON boundaries for the 6 pilot blocks in `data/sources/admin-boundaries/` to populate `administrative_units.geom`.
2. **Stage IMD 30-Year Gridded Rainfall (1991–2023)**: Stage the official IMD NetCDF/CSV grid tiles covering Tikamgarh and Chhatarpur ($24.0^\circ\text{N} - 25.5^\circ\text{N}$, $78.5^\circ\text{E} - 80.5^\circ\text{E}$).
3. **Execute Zonal Intersection & Update Indicators**: Once boundaries and baseline grids are staged, run the area-weighted spatial aggregation service to calculate verified rainfall anomalies and populate `derived_indicators.rainfall_anomaly_mm`.
