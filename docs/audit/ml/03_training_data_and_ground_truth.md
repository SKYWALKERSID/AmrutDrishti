# JAL DRISHTI — Training Data & Ground-Truth Audit
**Audit Date**: October 13, 2026  
**Document**: `03_training_data_and_ground_truth.md`  

---

## 1. Discovered Datasets & Ground-Truth Provenance

| Verification Dimension | CGWB Madhya Pradesh Manual Observations | IMD Gridded Rainfall Staging | Live Satellite Zonal Feeds |
|---|---|---|---|
| **File Location** | [`data/sources/cgwb_mp_cleaned_proper.csv`](file:///d:/Projects/JalDrishti/data/sources/cgwb_mp_cleaned_proper.csv) | [`data/sources/imd_rainfall_staged_sample.csv`](file:///d:/Projects/JalDrishti/data/sources/imd_rainfall_staged_sample.csv) | Ingested into Supabase `public.derived_indicators` via `scripts/cron_live_satellite_ingest.py` |
| **Origin / Source** | Central Ground Water Board (CGWB) via India-WRIS / National Hydrology Project | India Meteorological Department (IMD) 0.25° gridded rainfall / Open-Meteo | ESA Copernicus Sentinel-2 & NASA SMAP via Google Earth Engine API |
| **Total Rows** | 13,090 rows across Madhya Pradesh | 10 rows (sample staging) | 6 rows (1 per pilot block) |
| **Relevant Pilot Subset** | 289 rows strictly matching the 6 pilot blocks in Chhatarpur and Tikamgarh | 6 pilot block points | 6 pilot blocks |
| **Unique Monitoring Stations** | 34 distinct dug-wells and piezometers across the 6 pilot blocks | 6 virtual grid centroids | 6 block boundary MultiPolygons |
| **Temporal Coverage** | 2021-01 to 2023-11 (Quarterly manual tape readings) | 2024-01 to 2024-03 (Demonstration staging) | 2026-07-14 to 2026-10-12 (Live satellite lookback window) |
| **Observation Cadence** | Quarterly (Pre-monsoon: May, Monsoon: Aug, Post-monsoon: Nov, Rabi: Jan) | Daily aggregated to monthly | 5-day Sentinel-2 revisit; 3-day SMAP revisit |
| **Measurement Target** | Depth to Water Level in **metres below ground level (mbgl)** | Daily rainfall sum in mm | NDVI (0–1), NDWI (-1 to 1), Soil Moisture ($m^3/m^3$) |
| **Missing Values** | Preserved as `NaN` / `None`. No synthetic zeros injected. | Preserved as nulls. | No nulls in current live ingestion run. |
| **Invalid Outliers** | Filtered depths $< -5.0$m or $> 150.0$m. None found in pilot subset. | Negative values rejected by schema. | Validated in range. |
| **Data Status** | **Observed Real Ground Measurements** | Staged Reference Sample | **Live Observed Satellite Product** |

---

## 2. Granular Pilot Block Sample Distribution

The breakdown of actual observations extracted from `cgwb_mp_cleaned_proper.csv` by pilot block:

| Block Name | District | Lithology Complex | Valid Observation Quarters | Usable Temporal Matrices ($N$) | Evaluation Split (Train / Test) | Data Adequacy Rating |
|---|---|---|---|---|---|---|
| **Bijawar** | Chhatarpur | Granite / Gneiss Hard Rock | 75 | **69** | 55 Train / 14 Test | **Adequate for shallow tree boosting** |
| **Rajnagar** | Chhatarpur | Weathered Granite Gneiss | 78 | **72** | 57 Train / 15 Test | **Adequate for shallow tree boosting** |
| **Baldeogarh** | Tikamgarh | Bundelkhand Gneiss Complex | 22 | **18** | 14 Train / 4 Test | **Marginal (High uncertainty)** |
| **Jatara** | Tikamgarh | Granitic Weathered Mantle | 71 | **65** | 52 Train / 13 Test | **Adequate for shallow tree boosting** |
| **Palera** | Tikamgarh | Fractured Granite Basement | 16 | **13** | 10 Train / 3 Test | **Severely Starved ($N=13$)** |
| **Tikamgarh** | Tikamgarh | Bundelkhand Granite Complex | 58 | **52** | 41 Train / 11 Test | **Adequate for shallow tree boosting** |

---

## 3. Scientific Deficiencies in Ground-Truth Pipeline

1. **Station Spatial Heterogeneity**:
   The current pipeline averages multiple stations within a block into a single block-level time-series without weighting by aquifer sub-compartments. In fractured hard rock, two wells 2 km apart can have 10m depth differences due to fracture connectivity.
2. **Short Historical Time Span**:
   The CGWB dataset spans approximately 3 years (2021–2023). In Indian monsoonal hydrology, cyclical climate variability (El Niño / La Niña) operates on 3–7 year cycles. A 3-year baseline does not capture multi-year mega-drought cycles.
3. **Absence of Historical Satellite Collocation**:
   Historical Sentinel-2 NDVI and SMAP soil moisture were **not** co-registered historically for the 2021–2023 CGWB training records; thus, the model currently trains primarily on autoregressive lags (`lag_1`, `lag_2`, `lag_4`, drawdown velocity, season code). Environmental features are only attached at prospective inference time.
