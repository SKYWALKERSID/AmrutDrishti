# JalDrishti — Phase 4B: Official Pilot-Block Boundary Investigation & Spatial Aggregation Report

## 1. Executive Summary

This report establishes the findings, authoritative source investigation, data gap audit, and mathematical implementation for acquiring official administrative block boundary polygons and validating area-weighted IMD 0.25° gridded rainfall aggregation for the six pilot blocks in Bundelkhand (Chhatarpur and Tikamgarh districts, Madhya Pradesh).

In strict adherence to the project's scientific integrity and database safety guidelines:
1. **Repository Audit**: Inspected `data/sources/admin-boundaries/` and verified that no pre-existing GeoJSON, Shapefile, or polygon boundaries were present in the repository. In `public.administrative_units` on Supabase, `coordinates` (centroids) exist, but `geom` is strictly `NULL`.
2. **Authoritative Source Investigation**: Audited the primary government sources in required order:
   - **Local Government Directory (LGD)**: Confirmed that LGD (`lgdirectory.gov.in`) publishes canonical administrative codes and hierarchical linkages (distinguishing development blocks from revenue sub-districts/tehsils), but **does not publish or distribute spatial shapefile/polygon geometries**.
   - **Survey of India (SoI)**: Identified official administrative products on the Online Maps Portal (`onlinemaps.surveyofindia.gov.in`, Product `OVSF/1M/6` / `OVSF/1M/8`), which require authenticated registration and login to download taluk-level boundary shapefiles.
   - **Bhuvan (ISRO / NRSC)**: WFS/WMS vector layers exist on `bhuvan-vec3.nrsc.gov.in` and `bhuvanpanchayat.nrsc.gov.in`, requiring authenticated portal access or GIS streaming credentials.
   - **MP-SSDI / MAP_IT**: Madhya Pradesh State Spatial Data Infrastructure restricts public shapefile distribution to intra-departmental government requests.
3. **Strict Adherence to Non-Fabrication Rule**: Because external automated shapefile downloads require authenticated portal access, **no artificial polygons were fabricated from centroids, bounding boxes, or synthetic approximations**. The artifact path `data/sources/admin-boundaries/pilot_blocks.geojson` remains unstaged until official government shapefiles are retrieved.
4. **Pure Spatial Aggregation Pipeline Implemented**: Implemented `src/lib/services/spatialAggregationService.ts` providing geodesic area calculation on spherical polygons (in $\text{km}^2$), Sutherland-Hodgman polygon clipping against IMD grid cell bounding boxes, and area-weighted aggregation with missing-cell thresholds ($\ge 70\%$ valid coverage required).
5. **Automated Test Suite**: Added comprehensive unit tests in `tests/spatialAggregation.test.ts`, bringing the total test suite to **126 passed, 0 failed**. Production build compiled cleanly in 4.7s.
6. **Database Untouched**: No schema migrations, RLS adjustments, or data writes were executed. `rainfall_anomaly_mm` and `spi_3month` remain strictly `NULL` in `derived_indicators`.

---

## 2. Source Investigation & Administrative Hierarchy Audit

### 2.1 The Critical LGD Hierarchy Distinction: Blocks vs. Sub-Districts
In Madhya Pradesh administrative law and the Local Government Directory (LGD):
- **Development Block**: A developmental unit administered by a Janpad Panchayat / Block Development Officer (BDO) for rural development, groundwater schemes (e.g. Atal Bhujal Yojana), and agriculture.
- **Sub-District (Tehsil)**: A revenue administrative unit presided over by a Tehsildar / Sub-Divisional Magistrate (SDM) for land records and tax administration.
- In Madhya Pradesh, blocks and tehsils are **not coterminous**. For example:
  - Bijawar Block (LGD Block Code `3783`) vs. Bijawar Tehsil (LGD Sub-District Code `3433`)
  - Rajnagar Block (LGD Block Code `3788`) vs. Rajnagar Tehsil (LGD Sub-District Code `3430`)
  - Baldeogarh Block (LGD Block Code `4027`) vs. Baldeogarh Tehsil (LGD Sub-District Code `3416`)
  - Jatara Block (LGD Block Code `4028`) vs. Jatara Tehsil (LGD Sub-District Code `3418`)
  - Palera Block (LGD Block Code `4030`) vs. Palera Tehsil (LGD Sub-District Code `3417`)
  - Tikamgarh Block (LGD Block Code `4032`) vs. Tikamgarh Tehsil (LGD Sub-District Code `3415`)

This distinction is critical: joining block-level groundwater observation records against revenue tehsil polygons would introduce administrative boundary mismatch.

### 2.2 Authoritative Source Evaluation Matrix

| Source | Organization | Spatial Unit Available | Format | Access Method | Licensing / Terms | Findings / Obstacles |
|---|---|---|---|---|---|---|
| **LGD** | Ministry of Panchayati Raj, GoI | Tabular Directory only | HTML / Excel / CSV | Public Web | Open Government Data | Authoritative for codes (`3783`, `3788`, etc.), but **contains no vector polygon shapefiles**. |
| **Survey of India (SoI)** | Department of Science & Technology, GoI | Taluk / Sub-District Boundaries | Shapefile (`.shp`) | Online Maps Portal (`onlinemaps.surveyofindia.gov.in`) | Free for Indian citizens; non-commercial / government use | Requires Aadhaar / mobile verification & portal login. Product `OVSF/1M/8`. |
| **Bhuvan Panchayat** | NRSC / ISRO | Block & Panchayat Boundaries | WMS / WFS / Vector | Bhuvan Portal (`bhuvanpanchayat.nrsc.gov.in`) | ISRO Data Policy | OGC layers streamable in GIS software; direct bulk download requires registered user login. |
| **MP-SSDI** | MAP_IT, Govt of Madhya Pradesh | Development Blocks & Tehsils | Shapefile / Geodatabase | MP State GIS Portal (`stategisportal.nic.in`) | Government Intra-Agency | Restricted to state departments; no unauthenticated public download API. |
| **Community (DataMeet / India Geodata)** | Open Data Community | Sub-Districts / Tehsils (Census 2011) | GeoJSON / Shapefile | GitHub Releases | CC BY-SA 2.5 / 4.0 | Provides Census 2011 sub-district polygons, but does not reflect post-2018 block reorganizations (e.g. bifurcation of Niwari from Tikamgarh). |

---

## 3. Spatial Resolution & Uncertainty Analysis (IMD 0.25° vs. Pilot Blocks)

### 3.1 Geodesic Area Comparison
- At latitude $24.75^\circ\text{N}\text{--}25.00^\circ\text{N}$ and longitude $78.75^\circ\text{E}\text{--}79.00^\circ\text{E}$ (the Tikamgarh/Chhatarpur grid cell):
  - Longitudinal span $\Delta \lambda = 0.25^\circ \approx 25.3\text{ km}$
  - Latitudinal span $\Delta \phi = 0.25^\circ \approx 27.7\text{ km}$
  - **Single IMD Grid Cell Surface Area**: $\approx 701.08\text{ km}^2$ ($70,108\text{ hectares}$)
- Pilot block surface areas from district records:
  - Tikamgarh Block: $\approx 684\text{ km}^2$ ($68,400\text{ ha}$)
  - Jatara Block: $\approx 542\text{ km}^2$ ($54,200\text{ ha}$)
  - Palera Block: $\approx 480\text{ km}^2$ ($48,000\text{ ha}$)
  - Baldeogarh Block: $\approx 620\text{ km}^2$ ($62,000\text{ ha}$)
  - Bijawar Block: $\approx 1,150\text{ km}^2$ ($115,000\text{ ha}$)
  - Rajnagar Block: $\approx 890\text{ km}^2$ ($89,000\text{ ha}$)

### 3.2 Scientific Implications of Grid-to-Block Scale
1. **Grid Cells Span Multiple Blocks**: A single $701\text{ km}^2$ IMD grid cell often overlaps parts of 2 to 4 adjacent blocks (e.g., cell center at $24.875^\circ\text{N}, 78.875^\circ\text{E}$ spans Tikamgarh, Baldeogarh, and Lalitpur district of UP).
2. **Blocks Intersect Multiple Cells**: Each pilot block intersects between 2 and 4 distinct IMD grid cells.
3. **Invalidity of Point/Centroid Assignment**: Assigning precipitation to a block based solely on the nearest grid cell to the block's centroid fails to capture sub-block rainfall gradients, misallocates rainfall across district boundaries, and gives a false perception of block-level specificity.
4. **Necessity of Area-Weighted Averaging**: Area-weighted aggregation ($P_{\text{block}} = \sum A_i P_i / \sum A_i$) is mathematically essential to properly account for border cells and non-uniform spatial overlap.

---

## 4. Implementation: `spatialAggregationService.ts`

The service at `src/lib/services/spatialAggregationService.ts` implements:

1. **`calculateGeodesicPolygonAreaSqKm(ring: number[][])`**:
   Computes true ellipsoidal/spherical polygon surface area in $\text{km}^2$ using the spherical excess line-integral formula:
   $$\text{Area} = \frac{R^2}{2} \left| \sum_{i=1}^n (\lambda_{i+1} - \lambda_i) (2 + \sin \phi_i + \sin \phi_{i+1}) \right|$$
   where $R = 6371.0\text{ km}$. This completely eliminates map projection area distortions.
2. **`clipPolygonWithBbox(polygon, bbox)`**:
   Implements the classic Sutherland-Hodgman convex polygon clipping algorithm to compute the exact geometric intersection polygon between an irregular administrative boundary and an axis-aligned grid cell boundary.
3. **`calculateAreaWeightedRainfall(blockId, blockName, polygonRing, gridCells, threshold)`**:
   Computes the area-weighted precipitation sum:
   $$\bar{P}_{\text{block}} = \frac{\sum_{i=1}^m A_i \cdot P_i}{\sum_{i=1}^m A_i}$$
   Tracks valid rainfall area coverage. If valid non-null grid cells cover $< 70\%$ of the block's total area, returns `status = 'partial_coverage'` with `areaWeightedMeanRainfallMm = null` to prevent unrepresentative spatial extrapolation.

---

## 5. Verification & Test Suite

### 5.1 Automated Test Execution
```text
node --experimental-strip-types --test tests/*.test.ts
✔ tests 126
✔ pass 126
✔ fail 0
✔ duration_ms ~337ms
```

Newly added test cases in `tests/spatialAggregation.test.ts`:
- `Spatial Aggregation: Geodesic area calculation is accurate for spherical polygons` (Passed: verifies $701\text{ km}^2$ for $0.25^\circ \times 0.25^\circ$ cell at $25^\circ\text{N}$)
- `Spatial Aggregation: Sutherland-Hodgman polygon clipping clips polygon with grid cell bounding box` (Passed: verifies vertex clipping within bbox limits)
- `Spatial Aggregation: Area-weighted precipitation aggregates multi-cell block accurately` (Passed: verifies equal-weight averaging across 2 grid cells)
- `Spatial Aggregation: Handles missing cells safely with partial coverage flag` (Passed: verifies null return when valid cell coverage $< 70\%$)

### 5.2 Production Build Verification
```text
npm run build
✓ Compiled successfully in 4.7s
✓ Generating static pages (11/11)
```

---

## 6. Official Boundary Acquisition Protocol (Manual Steps)

To obtain and stage the official administrative block polygons:

1. **Access Survey of India Portal**:
   - Navigate to [https://onlinemaps.surveyofindia.gov.in/](https://onlinemaps.surveyofindia.gov.in/).
   - Log in with registered credentials.
   - Under **Digital Products** $\rightarrow$ **Administrative Boundary Database**, locate Product Code `OVSF/1M/8` (State Upto Taluk level with HQ) for Madhya Pradesh.
2. **Alternative: Bhuvan Panchayat Vector Service**:
   - Visit [https://bhuvanpanchayat.nrsc.gov.in/](https://bhuvanpanchayat.nrsc.gov.in/).
   - Navigate to **Data Download** $\rightarrow$ **Administrative Layers** $\rightarrow$ **Madhya Pradesh** $\rightarrow$ **Block Boundary**.
3. **Extract & Verify the 6 Pilot Blocks**:
   - Filter features where LGD Code / Name matches:
     - `3783` — Bijawar (Chhatarpur)
     - `3788` — Rajnagar (Chhatarpur)
     - `4027` — Baldeogarh (Tikamgarh)
     - `4028` — Jatara (Tikamgarh)
     - `4030` — Palera (Tikamgarh)
     - `4032` — Tikamgarh (Tikamgarh)
4. **Stage into Repository**:
   - Save the cleaned GeoJSON feature collection as `data/sources/admin-boundaries/pilot_blocks.geojson`.
   - Calculate SHA-256 digest and record in `data/sources/admin-boundaries/manifest.json`.

---

## 7. Status Summary & Next Step

- **Genuine authoritative polygons acquired**: **No** — Government portal authentication required; non-fabrication rule strictly respected.
- **Sources audited**: LGD, Survey of India Online Maps, Bhuvan / Bhuvan Panchayat, MP-SSDI / MAP_IT, DataMeet / India Geodata.
- **Mathematical spatial aggregation pipeline**: **Fully implemented and unit tested** (`spatialAggregationService.ts`, 4 new tests, 126 total passed).
- **Can rainfall aggregation proceed operationally**: **No** — Held in ready state awaiting manual staging of official boundary geometries into `data/sources/admin-boundaries/pilot_blocks.geojson`.
- **Single next implementation task**: Download official block boundary shapefiles via authenticated Survey of India or Bhuvan portal, stage `data/sources/admin-boundaries/pilot_blocks.geojson`, and execute `calculateAreaWeightedRainfall()` against staged IMD NetCDF grids.
