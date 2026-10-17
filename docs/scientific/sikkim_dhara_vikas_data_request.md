# JAL DRISHTI — Formal Data-Access Request Package
## Historical Mountain Spring Discharge Time Series (Dhara Vikas Initiative)

**Target Custodian:** Department of Rural Management and Development (RMDD), Government of Sikkim, Tashiling Secretariat, Gangtok - 737101  
**Collaboration Partner:** State Climate Change Cell / Water Security & Public Health Engineering Department, Sikkim  
**Project Reference:** JAL DRISHTI Open-Science Groundwater & Springshed Forecasting Initiative  
**Draft Date:** 2026-10-16  
**Status:** DRAFTED FOR HUMAN SCIENTIFIC REVIEW (NOT TRANSMITTED — NO UNAUTHORIZED CONTACT)

---

### 1. Research Context & Objective
JAL DRISHTI is an open-source, reproducible groundwater monitoring and statistical validation engine dedicated to improving seasonal water security across eight pilot and contrast states in India, including the state of Sikkim.

In Himalayan terrain, unconfined fractured rock springs (dharas) and seepage lakes provide $> 80\%$ of rural domestic water and irrigation. Because mountain springshed discharge behaves according to epikarst fracture flow rather than deep alluvial Darcy flow, JAL DRISHTI has engineered a dedicated, distinct springshed forecasting module operating exclusively in **Litres per Minute (L/min or LPM)**.

To calibrate analytical baseflow recession models ($Q(t) = Q_0 e^{-\alpha t}$) and probabilistic quantile predictors, we request historical spring gauge observations collected under the **Dhara Vikas** programme.

---

### 2. Specification of Requested Data Parameters

We formally request anonymized or open-access historical monitoring records covering monitored springs in East, West, North, and South Sikkim for the period **2015–2025**:

| Parameter Field | Preferred Units & Standards | Description |
| :--- | :--- | :--- |
| **Spring Identifier** | Unique Alphanumeric Code | Permanent station ID (e.g., `SK_SP_001` or Dhara Vikas registry code) |
| **Spring Name** | Local Vernacular Name | Local name of the dhara (e.g., *Malagiri Dhara*, *Dokung Dhara*) |
| **Geographic Coordinates** | Decimal Degrees (WGS84, EPSG:4326) | Latitude and Longitude of spring emergence or gauge point |
| **Administrative Unit** | State, District, Block, GPU | Gram Panchayat Unit (GPU), Block, and District |
| **Elevation** | Metres above Mean Sea Level (m MSL) | Spring orifice elevation |
| **Observation Timestamp** | Date (YYYY-MM-DD) & Time (IST) | Exact measurement date and sampling frequency (daily / weekly / monthly) |
| **Discharge Rate** | **Litres per Minute (L/min / LPM)** | Instantaneous measured discharge rate at spring outlet |
| **Measurement Method** | Categorical | V-Notch Weir, Parshall Flume, or Bucket-and-Stopwatch (timed volume) |
| **Spring Hydrogeological Type** | Categorical | Depression spring, Contact spring, Fracture/Fault spring, Karst spring |
| **Permanence Status** | Categorical | Perennial (year-round) or Seasonal / Ephemeral (monsoon only) |
| **Catchment / Recharge Zone ID** | Alphanumeric | Associated micro-watershed or Dhara Vikas artificial recharge trench area |
| **Quality Flags** | Categorical | Verified, provisional, sensor error, drought-dry (zero discharge) |

---

### 3. Data Protection, Ethical Use & Scientific Safeguards

1. **Non-Commercial Research Only:** All requested datasets will be used solely for open, reproducible scientific validation of springshed recession curves and seasonal discharge forecasting.
2. **Attribution & Provenance:** Full citation and attribution will be preserved in all documentation, referencing the Department of Rural Management and Development (RMDD), Government of Sikkim, and the Dhara Vikas programme.
3. **Zero Automated Ingestion to Production:** Raw files will be versioned locally with immutable SHA-256 checksums under strict quarantine until manual scientific review is completed.
4. **No Sensitive PII:** No private landholder names or domestic household identifiers are requested or stored.

---

### 4. Human Authorization & Review Sign-Off
- [ ] Lead Hydrogeologist Review Completed
- [ ] Data Protection Officer Sign-off
- [ ] Ready for Formal Transmission by Authorized Project Lead
