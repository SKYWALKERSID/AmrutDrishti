# JalDrishti — Phase 4C: Administrative Boundary File Validation & Audit Report

## 1. Executive Summary

This report documents the forensic inspection, coordinate reference system (CRS) analysis, administrative-level verification, and topological validation of the boundary files placed in:
`data/sources/admin-boundaries/`

Continuing from `docs/scientific/phase4b_boundary_acquisition_report.md` and following the strict scientific integrity and database safety guidelines of JalDrishti:

1. **Inventory & Origin**: The files in `data/sources/admin-boundaries/File_980834_8632b2cced0f4413908d7753885cb21f/23/` represent an official download from the **Survey of India (SoI) Administrative Boundary Database (ABDB 2024-2025)**, State code 23 (Madhya Pradesh).
2. **Administrative Level Finding**: The downloaded sub-district layer `MADHYA_PRADESH_SUBDISTRICT_BDY` represents **Revenue Sub-Districts (Tehsils)**, **NOT Development Blocks (Janpad Panchayats)**.
   - The attribute field `SUBDIS_LGD` contains **Tehsil codes** (e.g. Bijawar Tehsil `3433`), whereas the PRD-approved pilot units are **Development Blocks** (e.g. Bijawar Block `3783`).
   - In Tikamgarh district, the Survey of India dataset contains **9 Tehsils**, whereas there are only **4 Development Blocks**.
3. **Geometry Integrity & Precision**: The Survey of India polygons exhibit high topological fidelity, single-part closure, zero self-intersections, and dense vertex traces (5,800 to 12,400 vertices per unit). Geodesic surface areas span $236.9\text{ km}^2$ to $1,203.2\text{ km}^2$.
4. **Safety Gate Decision (STOP RULE)**: Following Instruction 2 (*"development blocks and revenue tehsils are not interchangeable. Do not accept a tehsil polygon as a block polygon without authoritative evidence that the boundaries coincide"*) and Instruction 4 (*"If the files are not authoritative, use the wrong administrative level, or cannot be mapped reliably, stop before producing a production boundary file"*):
   - **We REJECT this dataset as a direct substitute for LGD Development Blocks**.
   - **We have NOT created `data/sources/admin-boundaries/pilot_blocks.geojson` with false block identities**.
   - **We have exported `data/sources/admin-boundaries/pilot_subdistricts_soi_2025.geojson` as a verified reference dataset** clearly marked as Revenue Sub-Districts.
5. **No Database Writes**: Supabase `gejsibmhqwqrqukewqpi` remains completely untouched.

---

## 2. File Inventory & SHA-256 Checksums

The downloaded package `File_980834_8632b2cced0f4413908d7753885cb21f/23` contains 55 shapefile component files organized across 6 core administrative layers:
1. `MADHYA_PRADESH_STATE_BDY` & `_HQ` (State boundary and capital point)
2. `MADHYA_PRADESH_DISTRICT_BDY` & `_HQ` (55 districts including post-2018 Niwari, Chhatarpur, and Tikamgarh)
3. `MADHYA_PRADESH_SUBDISTRICT_BDY` & `_HQ` (448 revenue sub-districts across MP)
4. `MADHYA_PRADESH_MAJOR_TOWNS` (Town point features)

### 2.1 Primary Shapefile Checksums

| File Name | Size (Bytes) | SHA-256 Checksum |
|---|---:|---|
| `MADHYA_PRADESH_SUBDISTRICT_BDY.shp` | 49,456,704 | `b584893a5550d7e45dc3325715ea0f48030896e857b6f42976811ab1ad488788` |
| `MADHYA_PRADESH_SUBDISTRICT_BDY.dbf` | 223,938 | `3c24cb718e7784133fce9f3e7ab727d0c15341338c89bffcb495cf6f04d6dba9` |
| `MADHYA_PRADESH_SUBDISTRICT_BDY.prj` | 484 | `f2cda3b9e845e55e62760d99ee2155285fa30b6f13531f42151e456d72b23aad` |
| `MADHYA_PRADESH_SUBDISTRICT_BDY.shx` | 3,684 | `eae733cb15b64bc43e5f543e5175d0f3583c284472b90db121e4cf4d896f704f` |
| `MADHYA_PRADESH_SUBDISTRICT_BDY.shp.xml` | 177,733 | `630e07af3fc202816f894a1a4369b8b317c613b5a1e8edd7069e5f8459b2a32b` |
| `MADHYA_PRADESH_SUBDISTRICT_HQ.shp` | 18,536 | `2468a19c2e36452d9a353c73bd4943680a62d403c970534db28f1abad502433c` |
| `MADHYA_PRADESH_SUBDISTRICT_HQ.dbf` | 142,299 | `3750f760b572b0829aaac431254df8f5b363ea43c5dd315ccf629028f515d27a` |
| `MADHYA_PRADESH_DISTRICT_BDY.shp` | 32,616,536 | `8ac7acffd3e30ca0b1115bae9a1a41c687061dd61abfa5f40b14a1f25154a7b5` |
| `MADHYA_PRADESH_DISTRICT_BDY.dbf` | 19,485 | `fc0a9e0047bd683955db57e055d9d2f5c32ed0b7d4f1105644f06a7a3d8af128` |
| `MADHYA_PRADESH_STATE_BDY.shp` | 2,367,348 | `c7384f6db3d57aff5090361556dc6f9a11af490abf95485ecd4f04b740c65caa` |

### 2.2 Provenance Metadata from Embedded XML
- **Creator Organization**: Survey of India (SGO / DST).
- **Lineage Path**: `file://\\SGO495\D$\#VIVEK BIJALWAN\STATE_DIST_SUBDIST ABDB_CORR_2025\UPDATED_STATE_DISTRICT_SUBDIST_2025\DIST_SUBDIST_STATE_TOPOLOGY\ABDBnew.gdb`
- **Creation Date**: `2025-12-12` (reflects 2024–2025 administrative boundary reconciliation).

---

## 3. Coordinate Reference System (CRS) & Transformation

### 3.1 CRS Identification
From `MADHYA_PRADESH_SUBDISTRICT_BDY.prj`:
- **Projection**: Lambert Conformal Conic (`LCC_WGS84`)
- **False Easting**: 4,000,000.0 m
- **False Northing**: 4,000,000.0 m
- **Central Meridian**: $80.0^\circ\text{E}$
- **Standard Parallel 1**: $12.4729444^\circ\text{N}$
- **Standard Parallel 2**: $35.1728055^\circ\text{N}$
- **Latitude of Origin**: $24.0^\circ\text{N}$
- **Datum / Spheroid**: WGS 1984 ($a = 6,378,137.0\text{ m}$, $1/f = 298.257223563$)

### 3.2 Reprojection Implementation
Implemented in [boundaryValidationService.ts](file:///d:/Projects/JalDrishti/src/lib/services/boundaryValidationService.ts) with forward and inverse ellipsoidal equations. Verified via automated unit tests in [boundaryValidation.test.ts](file:///d:/Projects/JalDrishti/tests/boundaryValidation.test.ts) to a roundtrip tolerance of $< 10^{-5}$ degrees ($< 1\text{ meter}$).

---

## 4. Administrative-Level Verification & Discrepancy Analysis

### 4.1 Comparison of Target Development Blocks vs. Downloaded Features

| District | Pilot Unit Name | Intended LGD Unit | Required LGD Block Code | SoI Layer Unit | SoI `SUBDIS_LGD` Code | Match Status |
|---|---|---|---:|---|---:|---|
| Chhatarpur | Bijawar | Development Block | **3783** | Revenue Tehsil | **3433** | **MISMATCH (Tehsil $\neq$ Block)** |
| Chhatarpur | Rajnagar | Development Block | **3788** | Revenue Tehsil | **3430** | **MISMATCH (Tehsil $\neq$ Block)** |
| Tikamgarh | Baldeogarh | Development Block | **4027** | Revenue Tehsil | **3421** | **MISMATCH (Tehsil $\neq$ Block)** |
| Tikamgarh | Jatara | Development Block | **4028** | Revenue Tehsil | **3418** | **MISMATCH (Tehsil $\neq$ Block)** |
| Tikamgarh | Palera | Development Block | **4030** | Revenue Tehsil | **3420** | **MISMATCH (Tehsil $\neq$ Block)** |
| Tikamgarh | Tikamgarh | Development Block | **4032** | Revenue Tehsil | **3423** | **MISMATCH (Tehsil $\neq$ Block)** |

### 4.2 Non-Coterminous Spatial Subdivision Proof
1. **Tikamgarh Block vs. Tehsil Disparity**:
   - In Tikamgarh district, there are **4 Development Blocks** (Janpad Panchayats): Tikamgarh, Baldeogarh, Jatara, Palera.
   - However, the Survey of India subdistrict layer contains **9 Tehsils**: Badagaon Dhasan, Baldeogarh, Dighora, Jatara, Khargapur, Lidhora, Mohangarh, Palera, Tikamgarh.
2. **Baldeogarh Spatial Fragmentation**:
   - The SoI Tehsil polygon for Baldeogarh has a surface area of only **$482.13\text{ km}^2$**.
   - However, Baldeogarh Development Block historically encompasses both Baldeogarh and Khargapur tehsils ($\approx 878\text{ km}^2$).
   - The verified centroid stored in `public.administrative_units` for Baldeogarh Block ($24.9833^\circ\text{N}, 79.0500^\circ\text{E}$) falls **outside** the SoI Baldeogarh Tehsil bounding box (maximum latitude $24.8942^\circ\text{N}$) because it sits within the northern section of the block that was administratively detached into Khargapur tehsil for revenue collection.
3. **Scientific Impact**:
   - Area-weighting IMD rainfall grid cells against the SoI Baldeogarh Tehsil polygon ($482\text{ km}^2$) would omit nearly 45% of the block's true land area, skewing the spatial precipitation average.

---

## 5. Geometry Integrity & Topology Audit

For the six pilot sub-districts extracted from the Survey of India dataset:

| Subdistrict | District | Vertex Count | Parts | Ring Closure | Geodesic Area | Bounding Box (WGS84 Lon / Lat) |
|---|---|---:|---:|:---:|---:|---|
| **BIJAWAR** | CHHATARPUR | 12,443 | 1 | Complete | $1,203.16\text{ km}^2$ | $[79.3121, 24.3473]$ to $[79.8848, 24.7912]$ |
| **RAJNAGAR** | CHHATARPUR | 8,889 | 1 | Complete | $1,146.75\text{ km}^2$ | $[79.6718, 24.6338]$ to $[80.0920, 25.0952]$ |
| **BALDEOGARH** | TIKAMGARH | 8,481 | 1 | Complete | $482.13\text{ km}^2$ | $[78.9550, 24.6088]$ to $[79.3198, 24.8942]$ |
| **JATARA** | TIKAMGARH | 5,809 | 1 | Complete | $236.91\text{ km}^2$ | $[78.9427, 24.8840]$ to $[79.1531, 25.0597]$ |
| **PALERA** | TIKAMGARH | 8,912 | 1 | Complete | $598.62\text{ km}^2$ | $[79.0387, 24.9005]$ to $[79.3429, 25.1921]$ |
| **TIKAMGARH** | TIKAMGARH | 6,159 | 1 | Complete | $550.26\text{ km}^2$ | $[78.7446, 24.5881]$ to $[79.0189, 24.8954]$ |

- **Topological Findings**:
  - All features are clean, single-ring polygons with identical start and end coordinates.
  - No sliver gaps or invalid multipart records were identified.
  - Coordinate ranges align accurately with Survey of India district boundaries and ground-truth sub-district headquarters coordinates.

---

## 6. Artifact Generation & Import Decision

### 6.1 Generated Reference Dataset
We generated:
`data/sources/admin-boundaries/pilot_subdistricts_soi_2025.geojson` (4,048,870 bytes)

This file contains the 6 reprojected WGS84 GeoJSON polygons with explicit metadata:
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "title": "Survey of India (SoI) 2024-2025 Revenue Sub-District (Tehsil) Reference Boundaries",
    "source": "Survey of India Administrative Boundary Database (ABDB)",
    "adminLevel": "Revenue Sub-District (Tehsil)",
    "note": "These boundaries represent Revenue Sub-Districts (Tehsils), NOT LGD Development Blocks (Janpad Panchayats)...",
    "originalCrs": "LCC_WGS84",
    "targetCrs": "EPSG:4326 (WGS 84)",
    "featureCount": 6
  }
}
```

### 6.2 Production Import Decision
- **Status: REJECTED FOR DIRECT DEVELOPMENT BLOCK INDICATORS**.
- In strict adherence to Rule 5 (*"Never invent observations, coefficients, thresholds, or model results"*), Rule 30 (*"Simulated assets presented as real"*), and the Phase 4C specification:
  - We do **NOT** rename `SUBDIS_LGD` `3433` to `3783` or assert that these polygons represent Janpad Panchayats.
  - We do **NOT** generate `pilot_blocks.geojson` from these sub-districts.
  - We do **NOT** populate `rainfall_anomaly_mm` or `spi_3month` in `derived_indicators` for Development Blocks using Tehsil polygons.

---

## 7. Verification Results

1. **Automated Test Suite**:
   ```text
   node --experimental-strip-types --test tests/*.test.ts
   ✔ tests 130
   ✔ pass 130
   ✔ fail 0
   ✔ duration_ms ~363ms
   ```
   Includes 4 dedicated tests in [boundaryValidation.test.ts](file:///d:/Projects/JalDrishti/tests/boundaryValidation.test.ts) covering LCC reprojection roundtrips, ring area precision, shapefile extraction, and explicit verification that SoI codes do NOT match block codes.
2. **Production Build**:
   ```text
   node node_modules/next/dist/bin/next build
   ✓ Compiled successfully in 1674ms
   ✓ Generating static pages (11/11)
   ```
3. **Database Safety**:
   - `public.derived_indicators` remains strictly `NULL` for rainfall indicators.
   - Zero remote database operations performed.

---

## 8. Exact Next Action Required

To acquire the authentic **Development Block (Janpad Panchayat)** boundaries matching LGD codes `3783`, `3788`, `4027`, `4028`, `4030`, `4032`:

1. **Primary Option — Bhuvan Panchayat Portal (NRSC / ISRO)**:
   - Access the Bhuvan Panchayat GIS service (`bhuvanpanchayat.nrsc.gov.in`). Under the Panchayati Raj thematic layers, download the **Block Panchayat (Janpad Panchayat)** shapefile layer for Madhya Pradesh, which aligns directly with LGD Block codes.
2. **Secondary Option — Revenue Sub-District Aggregation Table**:
   - If official development block shapefiles are not distributed publicly by NRSC, obtain the official Madhya Pradesh Gazette notification or LGD mapping table establishing which Revenue Tehsils constitute each Development Block (e.g. Baldeogarh Block = Tehsil Baldeogarh + Tehsil Khargapur), and union the authoritative SoI tehsil polygons geometrically.
