# JAL DRISHTI — Feature Engineering & Preprocessing Audit
**Audit Date**: October 13, 2026  
**Document**: `07_features_and_preprocessing.md`  

---

## 1. Feature Registry & Provenance Audit

The table below audits every feature engineered in `ml/feature_engineering.py` and specified in `ml/config.py`.

| Feature Name | Mathematical / Operational Definition | Units | Data Source | Missing Rate in Raw Data | Transformation / Preprocessing | Status in Current Training | Leakage Risk |
|---|---|---|---|---|---|---|---|
| `water_level_lag_1` | Groundwater depth at previous quarter $t-1$ | mbgl | CGWB Quarterly Observations | 0% (Rows with nulls dropped) | `shift(1)` causal lag | **Active** | None |
| `water_level_lag_2` | Groundwater depth at 2 quarters prior $t-2$ | mbgl | CGWB Quarterly Observations | 0% (Rows with nulls dropped) | `shift(2)` causal lag | **Active** | None |
| `water_level_lag_4` | Groundwater depth at same season previous year $t-4$ | mbgl | CGWB Quarterly Observations | ~15% on early records | `shift(4)` seasonal lag | **Active** | None |
| `drawdown_velocity_q1` | Quarterly drawdown rate: $\Delta L = \text{lag}_1 - \text{lag}_2$ | m/quarter | Derived from CGWB lags | 0% | Difference of causal lags | **Active** | None |
| `season_code` | Discrete quarterly season index (0: Q1, 1: Q2, 2: Q3, 3: Q4) | Integer (0–3) | Observation timestamp | 0% | `dt.quarter - 1` | **Active** | None |
| `rainfall_cum_3m` | 90-day cumulative rainfall | mm | IMD 0.25° Gridded Rainfall | 100% in historical CGWB CSV | Rolling temporal sum | *Configured, but unpopulated in historical matrix* | None |
| `spi_3month` | Standardized Precipitation Index (3-month) | Dimensionless | IMD Gridded Rainfall | 100% in historical CGWB CSV | Gamma distribution z-score | *Configured, but unpopulated in historical matrix* | None |
| `grace_twsa_cm` | Terrestrial Water Storage Anomaly | cm | NASA GRACE-FO Tellus Mascons | 100% in historical CGWB CSV | Zonal spatial mean anomaly | *Configured, but unpopulated in historical matrix* | None |
| `sentinel_ndvi` | Normalized Difference Vegetation Index | Dimensionless (-1 to 1) | Copernicus Sentinel-2 MSI | Live feed only | $(B8 - B4) / (B8 + B4)$ | *Populated in live DB, omitted in offline training* | Training-serving skew |
| `smap_soil_moisture` | Rootzone volumetric soil moisture | $\text{m}^3/\text{m}^3$ | NASA SMAP L4 | Live feed only | Zonal spatial mean | *Populated in live DB, omitted in offline training* | Training-serving skew |

---

## 2. Key Preprocessing Vulnerabilities

1. **Training-Serving Skew (Offline vs. Online Mismatch)**:
   - During **offline training** (`ml/train.py`), the model trains strictly on 5 tabular features: `water_level_lag_1`, `lag_2`, `lag_4`, `drawdown_velocity`, and `season_code`.
   - During **live observation ingestion** (`scripts/cron_live_satellite_ingest.py`), the database stores `sentinel_ndvi`, `smap_soil_moisture`, and `spi_3month`.
   - **Defect**: The offline model was never taught how to correlate NDVI and SMAP with aquifer recharge because those historical satellite rasters were not joined to the 2021–2023 training matrix.

2. **Irregular Temporal Sampling Assumption**:
   - CGWB manual monitoring wells are sampled roughly 4 times a year, but exact dates vary (e.g. May 12 vs June 4).
   - The lag operations treat the data as a rigid evenly spaced time-series without continuous day-count interpolation.
