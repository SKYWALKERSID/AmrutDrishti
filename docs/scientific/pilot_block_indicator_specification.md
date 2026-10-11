# JalDrishti — Pilot Block Indicator Specification (v1.0)

## 1. Context & Purpose

This specification defines the methodology for deriving block-level groundwater indicators from genuine, published historical CGWB/NWIC quarterly monitoring observations in the JalDrishti database.

The purpose is to move JalDrishti from raw unaggregated observation time-series to reproducible, data-backed indicators for the six approved pilot blocks in Tikamgarh and Chhatarpur districts (Madhya Pradesh), without inventing missing values, fabricating synthetic composite scores, or claiming uncalibrated predictive AI.

---

## 2. Distinction of Data Types

To preserve strict scientific integrity, the data pipeline strictly differentiates five categories:
1. **Observed Measurements**: Point measurements of groundwater levels (`water_level_mbgl`) at specific monitoring stations on specific dates.
2. **Descriptive Statistics**: Direct statistical aggregations of observed measurements across defined spatial units and time windows (e.g., mean depth, min depth, max depth, station count).
3. **Derived Indicators**: Standardized hydrogeological metrics computed using verified scientific formulas and physical constants (e.g., annualized water table trend $\text{m/yr}$ via ordinary least-squares regression over time).
4. **Descriptive Risk Severity**: Rule-based categorization (`normal`, `watch`, `severe`, `gap`) derived strictly from threshold comparisons of available observed indicators, with explicit `gap` classification when coverage is insufficient.
5. **Predictive Model Outputs / AI**: Machine learning forecasts. *Status in this release*: Strictly tagged as `simulated` or `null`; never presented as authoritative ground-truth without independent field validation.

---

## 3. Approved Pilot Blocks & Spatial Identifiers

All calculations apply strictly to the six approved pilot blocks in Madhya Pradesh:

| Block Unit ID | Block Name | District Unit ID | District Name | Total Stations | Non-Null Observations | Date Range |
|---|---|---|---|---|---|---|
| `3783` | BIJAWAR | `398` | CHHATARPUR | 8 | 72 | 2021-01-10 to 2023-08-20 |
| `3788` | RAJNAGAR | `398` | CHHATARPUR | 8 | 74 | 2021-01-10 to 2023-08-20 |
| `4027` | BALDEOGARH | `434` | TIKAMGARH | 2 | 20 | 2021-01-10 to 2023-08-20 |
| `4028` | JATARA | `434` | TIKAMGARH | 7 | 67 | 2021-01-10 to 2023-08-20 |
| `4030` | PALERA | `434` | TIKAMGARH | 2 | 14 | 2021-01-10 to 2023-08-20 |
| `4032` | TIKAMGARH | `434` | TIKAMGARH | 7 | 55 | 2021-01-10 to 2023-08-20 |

---

## 4. Indicator Definitions & Formulas

### Indicator 1: Block Mean Groundwater Depth (`cgwb_well_depth_mbgl`)
- **Purpose**: Represents the representative block-level groundwater depth below ground surface for the latest observation window.
- **Formula**:
  $$\bar{d}_{\text{block}}(t_{\text{latest}}) = \frac{1}{N_{\text{valid}}} \sum_{i=1}^{N_{\text{valid}}} d_i(t_{\text{latest}})$$
  where $d_i$ is the water level in meters below ground level ($\text{m bgl}$) at station $i$ on the latest available observation date $t_{\text{latest}}$, and $N_{\text{valid}}$ is the number of stations with non-null measurements on that date. If the latest quarterly campaign has 0 valid measurements for a block, fallback to the preceding quarterly campaign with valid measurements.
- **Unit**: Meters below ground level ($\text{m bgl}$).
- **Minimum Data Requirement**: At least 1 non-null observation on the observation date.

### Indicator 2: Annualized Water Table Drawdown Trend (`well_depth_trend_m_per_yr`)
- **Purpose**: Measures the multi-year rate of change in groundwater table depth across the observation period.
- **Formula**:
  Ordinary Least Squares (OLS) linear regression of all valid station observations in the block across time $t$ (in years):
  $$\beta = \frac{\sum (t_i - \bar{t})(d_i - \bar{d})}{\sum (t_i - \bar{t})^2}$$
  - A positive $\beta$ represents increasing water level depth below ground (i.e. drawdown / water table decline).
  - A negative $\beta$ represents decreasing water level depth below ground (i.e. recharge / water table recovery).
- **Unit**: Meters per year ($\text{m/yr}$).
- **Minimum Data Requirement**: At least 4 distinct observation dates spanning $\ge 1$ year and $\ge 5$ non-null observations.
- **Missing Data Handling**: If requirements are not met, set to `NULL`.

### Indicator 3: Uncalibrated Multi-Criteria Indicators
- `grace_twsa_cm`: NASA GRACE-FO Terrestrial Water Storage Anomaly. Set to `NULL` pending verified downscaling pipeline.
- `rainfall_anomaly_mm`: IMD rainfall anomaly. Set to `NULL` pending gridded precipitation ingestion.
- `spi_3month`: Standardized Precipitation Index. Set to `NULL`.
- `sentinel_ndvi`, `sentinel_ndwi`: Sentinel-2 vegetation indices. Set to `NULL`.
- `smap_soil_moisture`: SMAP soil moisture. Set to `NULL`.

*Scientific Safeguard*: These unpopulated indicators MUST remain SQL `NULL` and MUST NOT be converted to `0`.

### Indicator 4: Descriptive Risk Severity (`risk_severity`)
- **Purpose**: Transparent heuristic classification of groundwater stress based exclusively on observed aquifer drawdown.
- **Rule**:
  Evaluated using the verified `calculateDescriptiveGss` engine:
  - If $\bar{d}_{\text{block}} \ge 12.0\text{ m bgl}$ or $\beta \ge 0.5\text{ m/yr}$ drawdown: `severe`
  - If $\bar{d}_{\text{block}} \ge 7.0\text{ m bgl}$ or $\beta \ge 0.2\text{ m/yr}$ drawdown: `watch`
  - If $\bar{d}_{\text{block}} < 7.0\text{ m bgl}$ and $\beta < 0.2\text{ m/yr}$: `normal`
  - If observations are insufficient or missing: `gap`
- **Output**: `RiskSeverityEnum` (`normal`, `watch`, `severe`, `gap`).

---

## 5. Traceability & Lineage Metadata
- `data_status`: Set to `'observed'` (indicating indicators derived from observed field measurements).
- `assessed_date`: Latest observation date in the aggregation window (`2023-08-20` for blocks with August readings, `2023-05-20` for Palera).
- `safeguard_notice`: *"Derived from 305 published CGWB quarterly monitoring well measurements (2021-2023). Unmeasured satellite and rainfall parameters preserved as null. Not an AI forecast."*
- `primary_stress_driver`: Transparent textual summary of observed state (e.g., *"Observed post-monsoon well level depth of 7.47 m bgl across 7 monitoring wells."*).

---

## 6. Concrete Calculation Results for the 6 Pilot Blocks

| Block ID | Block Name | Latest Date | Valid Stations at Latest Date | Latest Mean Depth (m bgl) | OLS Trend (m/yr) | Risk Severity |
|---|---|---|---|---|---|---|
| `3783` | BIJAWAR | 2023-08-20 | 7 / 8 | 7.47 | -0.047 | `watch` |
| `3788` | RAJNAGAR | 2023-08-20 | 8 / 8 | 4.39 | -0.315 | `normal` |
| `4027` | BALDEOGARH | 2023-08-20 | 2 / 2 | 1.23 | -0.661 | `normal` |
| `4028` | JATARA | 2023-08-20 | 5 / 7 | 3.90 | -0.360 | `normal` |
| `4030` | PALERA | 2023-05-20* | 2 / 2 | 4.83 | -1.179 | `normal` |
| `4032` | TIKAMGARH | 2023-08-20 | 2 / 7 | 5.96 | +0.152 | `normal` |

*\*Note on Palera (`4030`)*: On `2023-08-20`, Palera had 1 observation, which was a missing measurement (`NULL`). In accordance with the missing-data rule, Palera's latest representative groundwater depth is computed from the immediately preceding campaign with valid observations (`2023-05-20`), yielding $4.83\text{ m bgl}$.
