# Jal Drishti — Official Groundwater Data Acquisition, Telemetry Calibration & Scientific Integrity Runbook

**Document Version:** 1.0.0-scientific-integrity  
**Date:** October 25, 2026  
**Active telemetry scope:** 9 approved states, 43 canonical blocks (Assam excluded)  
**Core Model:** `GlobalBlockAwareQuantileGB-v1`  
**Operational Status:** `operationalEligibility: false` (strictly maintained)

> **Current NWDP contract (supersedes legacy telemetry statements below):** only the 18
> retained CSVs in `data/sources/nwdp_telemetry_raw/` are active NWDP raw inputs.
> Their values are source-reported telemetry in the header's stated meter unit;
> station datum/sign convention and station-to-block containment are unverified.
> Experimental station forecasting is separate from trusted block observations.
> No NWDP-derived block observations are currently published; all 43 blocks remain
> fail-closed and the 400-day gate is unchanged. Use the single freshness-aware
> entry point `python scripts/nwdp_pipeline.py --train --refresh-readiness`.
> It verifies raw hashes, rebuilds only when inputs/processing versions/output
> hashes require it, validates the current lineage on every invocation, then
> passes those verified outputs to training and readiness generation. The
> lower-level rebuild and validator scripts remain callable for diagnostics,
> but should not be run as a separate routine sequence before training.

---

## 1. Executive Summary & Purpose

This operational runbook documents the data discovery, station mapping, telemetry calibration protocol, and block readiness criteria for Jal Drishti. It establishes a rigorous, scientifically defensible boundary between raw observation datasets, experimental telemetry streams, research-grade predictions, and operational decision-making.

In accordance with Jal Drishti Scientific Invariants (Rule 5):
- No prediction is emitted without verified fresh observations ($\le 400$ days old).
- No uncalibrated telemetry is introduced into global model inference.
- No station mapping is asserted without official CGWB/State administrative cross-references.
- No synthetic or simulated values are ever written to production registries or used to claim real-world coverage.

---

## 2. Official Source Discovery & Catalog Registry

| Source Identifier | Official Organization | Dataset / Resource Description | Temporal Coverage | Measurement Semantics & Native Units | Access Protocol | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `CGWB_MANUAL_QUARTERLY_HISTORICAL` | Central Ground Water Board (CGWB) | Quarterly manual water level measurements from national hydrograph stations. | 1991 – 2025 (latest Jan 30, 2025) | Depth to water table in **meters below ground level (m bgl)**. Datum: Measuring point elevation / ground level. | Open Access / NWIC archive | **Approved & Verified** for model training; currently **stale** relative to 2026 ($> 400$ days). |
| `NWDP_RETAINED_TELEMETRY_18_RESOURCES` | NWDP/NWIC resource portal; issuing agency as specified per retained metadata or left unspecified | 18 retained 6-hourly telemetry CSVs across nine approved states and two catalogue periods per state. | Actual timestamp coverage is recomputed from each resource; filename period is not treated as observation coverage. | Source header reports meter; station-specific measurement variable, installation depth, datum, calibration, and sign convention are not established. | Retained local CSVs with SHA-256 registry | Experimental station-level input only; excluded from verified groundwater-depth and trusted block observations. |
| `IMD_GRIDDED_RAINFALL` | India Meteorological Department (IMD) | High-resolution daily gridded precipitation ($0.25^\circ \times 0.25^\circ$). | Historical – Present | Daily rainfall in **mm**. Missing value flag: `-999.0`. | Binary gridded / netCDF download | **Approved & Verified** for spatial precipitation aggregation. Missing values strictly quarantined. |

---

## 3. Server-Side Reproducible Ingestion Workflow

All observation ingestion occurs out-of-band via server-side routines. Individual user forecast requests **never** trigger remote network downloads or expensive data processing.

```
  ┌─────────────────────────────────────────────────────────────┐
  │                 Official Government Source                  │
  │     (NWDP / CGWB / State Groundwater Department APIs)       │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ Scheduled / Explicit Ingestion
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │              Server-Side Ingestion Adapter                  │
  │  - Enforce bounded timeouts and backoff                     │
  │  - Validate schema and column headers                       │
  │  - Quarantine missing flags (-999.0, null, NaN)             │
  │  - Preserve source values; quarantine negatives without sign conversion │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ Normalized & Verified
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │        Trusted Observation Provider (In-Memory Cache)       │
  │  - Read-only local approved ledger                          │
  │  - 60s memory cache (NEVER modifies observation timestamp)   │
  │  - Fail-closed on missing/unverified station mappings       │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
                 Downstream Serving & Verification
```

---

## 4. Official Station-to-Block Verification Protocol

### Current Status (43 Active Canonical Blocks)
- **0 verified NWDP block mappings:** station-to-block evidence and measurement semantics are not established by the retained local files.
- **43 blocks fail closed:** no NWDP candidate telemetry is published as a trusted block observation; the existing 400-day freshness threshold remains in force.

### Mandatory Mapping Verification Rules
1. **No District Substitution:** A well in district $D$ can NEVER be used as a proxy for block $B$ unless official administrative records place that well inside block $B$.
2. **No Spelling or Approximate Coordinate Inferences:** Similar names (e.g. `Banda` in Sagar vs. Banda district) must be cross-referenced with official sub-district LGD codes.
3. **No Aquifer Mixing:** Shallow open wells and deep fracture piezometers within the same block must be maintained as distinct hydrogeological series (e.g., Coimbatore `P.N.palayam` shallow well at $\sim 5\text{ m}$ vs. `Kalviramapalayam` deep well at $\sim 48\text{ m}$).
4. **Border Spatial Matches:** If coordinates are evaluated against sub-district boundaries, boundary polygons must come from official Survey of India / LGD datasets, and any station within 500m of a border requires manual review.

---

## 5. Telemetry Calibration Protocol & Invariants

Automated telemetry sensors (DWLR) cannot be assumed to measure water table depth relative to ground level without rigorous calibration.

### Invariant 1: Physical Sign Convention
The retained NWDP CSVs do not establish a groundwater-depth sign convention. Negative readings remain unconverted and quarantined; no physical interpretation is assigned without station-specific authoritative documentation.
- **Rule:** Antigravity and Jal Drishti code will **NEVER** invert signs (`abs(val)` or `-1 * val`) or add arbitrary scalar offsets without official manufacturer/sensor installation records.

### Invariant 2: Colocated Concurrent Pairing Requirement
Telemetry can only be considered calibrated if paired against manual chalk-and-tape or electric sounder measurements that satisfy:
- **Same Well / Borehole:** The manual measurement must be from the exact same casing or a documented collocated twin well.
- **Temporal Pairing Window:** Maximum $\pm 48\text{ hours}$.
- **Sufficient Sample Size:** Minimum 8 independent seasonal pairs spanning at least 2 full hydrologic cycles (pre-monsoon and post-monsoon).
- **Temporal Holdout Validation:** Calibration coefficients must be tested on a chronologically separated holdout set; in-sample regression fitting is insufficient.

### Invariant 3: Global Model Training Target Compatibility
The global model `GlobalBlockAwareQuantileGB-v1` was trained on quarterly manual observations representing static water levels after recovery. High-frequency 6-hourly telemetry captures localized pumping drawdown, barometric pressure fluctuations, and diurnal noise. Direct feed of 6-hourly telemetry into quarterly-trained models without validated aggregation violates input compatibility and is strictly rejected.

---

## 6. Block Readiness Audit & Verification Summary

| Metric / Dimension | Value | Audit Verdict |
| :--- | :--- | :--- |
| **Total Scope** | 10 States, 34 Districts, 56 Blocks | Exactly matches canonical specification |
| **Blocks with Verified Mapping** | 34 Blocks | Verified against CGWB manual records |
| **Blocks with Unverified Mapping** | 22 Blocks | Fail-closed; retained as `unverified_station_mapping` |
| **Fresh Observations ($\le 400$ days)** | **0 Blocks** | All approved manual records end Jan 2025 ($> 630$ days old) |
| **Calibrated Telemetry Available** | **0 Blocks** | Zero concurrent manual pairs; unverified sensor datums |
| **Eligible for Research Prediction** | **0 Blocks (0 / 56)** | Freshness gate and calibration gates strictly enforced |
| **Operational Eligibility** | **0 Blocks (0 / 56)** | Operational use strictly forbidden (`false` everywhere) |

---

## 7. Operational Runbook & Next Implementation Actions

1. **Obtain Official LGD-to-CGWB Station Crosswalk:**
   - Procure the official CGWB National Groundwater Information System (NGWIS) station-to-LGD block directory to resolve the 22 unverified blocks.
2. **Execute DWLR Ground-Truthing Field Campaign:**
   - Coordinate with State Ground Water Departments (Karnataka, Telangana) to collect contemporaneous manual dip-meter readings during DWLR telemetry transmissions to build valid calibration pairs.
3. **Automate Nightly Ingestion Sync via Server-Side Cron:**
   - Deploy `scripts/assess_telemetry_calibration.py` and the server-side ingestion routine in a containerized cron task isolated from the client-facing Next.js frontend.
