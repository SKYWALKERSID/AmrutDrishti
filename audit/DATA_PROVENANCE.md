# JalDrishti — Data Provenance & Scientific Safeguards

This document records the source, spatial resolution, temporal frequency, ingestion status, transformation methods, and scientific disclaimers for every dataset integrated or referenced in JalDrishti.

---

## 1. Primary Datasets Summary

| Dataset Name | Source Agency | Spatial Support / Resolution | Temporal Frequency | Units | Ingestion Status | Scientific Role & Caveats |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CGWB Ground Water Wells** | Central Ground Water Board (MoJS) | Point (Monitoring Well location) | Pre/Post Monsoon (Quarterly) | meters below ground level (m bgl) | **INGESTED (Fixtures)** | Primary ground-truth depth indicator. Point observations cannot be linearly interpolated across fractured granite aquifer basements without structural geophysics. |
| **GRACE / GRACE-FO TWSA** | NASA / JPL / GFZ | Coarse Grid (~100 km / 1° × 1°) | Monthly | Equivalent Water Height (cm) | **INGESTED (Fixtures)** | Measures regional Terrestrial Water Storage Anomaly. **CRITICAL:** GRACE data CANNOT measure village-level well depth directly due to coarse spatial resolution. |
| **Monsoon Rainfall Deficit** | India Meteorological Department (IMD) | Grid (0.25° × 0.25°) / Block average | Daily / Seasonal Cumulative | millimeters (mm) | **INGESTED (Fixtures)** | Meteorological drought indicator. Rainfall deficit is an input to GSS, but local recharge depends heavily on soil permeability and monsoon intensity. |
| **SMAP Soil Moisture** | NASA Soil Moisture Active Passive | Grid (~9 km / 36 km) | 2-3 Days | $\text{m}^3/\text{m}^3$ (volumetric) | **CONFIGURED** | Near-surface topsoil moisture (0-5 cm). Does not directly indicate deep confined aquifer storage. |
| **Sentinel-2 NDVI** | ESA Copernicus Sentinel-2 | 10 m Resolution | 5 Days | Normalized Index (-1 to +1) | **CONFIGURED** | Vegetation vigor proxy. Used as indirect indicator of irrigated cropland extent and surface water presence. |

---

## 2. Scientific Safeguards & Disclaimers

### Safeguard A: Spatial Resolution Non-Equivalence
- **Rule:** Satellite gravity anomalies (GRACE) operate at regional basin scales (~10,000 $\text{km}^2$). CGWB wells measure localized aquifer heads.
- **Enforcement:** The GIS map and monitoring charts explicitly state spatial scale differences to prevent improper downscaling claims.

### Safeguard B: Prohibition of Panic Wording
- **Rule:** Unvalidated machine learning predictions (e.g., LSTM extrapolation) must not output authoritative "days-to-crisis" countdowns or false precision.
- **Enforcement:** All predictive indicators are tagged as **DEMO / RESEARCH MODE ONLY**. Mandatory Safe Wording Policy (FR-056) restricts advisory text to empirical observations and seasonal guidelines.

### Safeguard C: Composite Risk Weighting (GSS)
- **Formula:**
  $$\text{GSS} = 0.35 \times \text{TWSA} + 0.30 \times \text{Well Depth Trend} + 0.20 \times \text{Rainfall Deficit} + 0.15 \times \text{Soil Moisture}$$
- **Override Policy:** Hydrogeologists must provide written rationale before overriding an automated block risk rating, ensuring human-in-the-loop scientific oversight.
