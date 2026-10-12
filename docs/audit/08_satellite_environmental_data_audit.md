# JalDrishti — Phase Eight: Satellite & Environmental Data Audit

**Document File:** `docs/audit/08_satellite_environmental_data_audit.md`

---

## 1. Satellite Products Inventory

| Satellite Product | Source Agency | Spatial Resolution | Temporal Frequency | Units | Current Status | Scientific Caveat & Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GRACE / GRACE-FO TWSA** | NASA JPL / GFZ Potsdam | Coarse Grid (~100 km / 1° × 1°) | Monthly | Equivalent Water Height (cm) | **CONFIGURED / FIXTURE ONLY** | Regional Terrestrial Water Storage Anomaly. Cannot measure localized village well depths directly. |
| **SMAP Soil Moisture** | NASA JPL | 9 km / 36 km Grid | 2–3 Days | $\text{m}^3/\text{m}^3$ (volumetric) | **CONFIGURED / FIXTURE ONLY** | Surface soil moisture (top 0–5 cm). Does not indicate deep fractured basement storage. |
| **Sentinel-2 NDVI / NDWI** | ESA Copernicus | 10 m Multispectral | 5 Days | Normalized Ratio (-1 to +1) | **CONFIGURED / FIXTURE ONLY** | Vegetation vigor and surface water proxy. Used to monitor irrigated cropland extent. |

---

## 2. Findings on Satellite Pipeline
1. **Zero Raw Satellite Assets:** The repository contains no downloaded HDF5 (SMAP), NetCDF/Tellus (GRACE), or GeoTIFF (Sentinel-2) binaries.
2. **Database Representation:** Schema columns exist in `derived_indicators` (`grace_twsa_cm`, `smap_soil_moisture`, `sentinel_ndvi`, `sentinel_ndwi`). In `ALL_BLOCKS`, values are representative mock fixtures.
3. **Mandatory Scientific Disclaimer:** Maps and dashboards correctly render Safeguard A notices: *"GRACE gravity anomalies operate at regional basin scale (~10,000 km²). Do not treat as localized well measurements."*
