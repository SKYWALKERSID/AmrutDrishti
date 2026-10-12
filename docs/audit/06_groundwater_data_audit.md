# JalDrishti — Phase Six: Historical Groundwater Data Audit

**Document File:** `docs/audit/06_groundwater_data_audit.md`  
**Data Reference:** Central Ground Water Board (CGWB) Madhya Pradesh manual quarterly observations (2021–2025).

---

## 1. Provenance & Staged Source Inspection
- **Source File:** [`gwl_manual_quarterly_cgwb_mp_2021_2025.xlsx`](file:///D:/Projects/JalDrishti/gwl_manual_quarterly_cgwb_mp_2021_2025.xlsx) (1,131,572 bytes) and preview [`docs/data/cgwb_mp_2021_2025_xlsx_preview.json`](file:///D:/Projects/JalDrishti/docs/data/cgwb_mp_2021_2025_xlsx_preview.json).
- **Origin Agency:** Central Ground Water Board (Department of Water Resources, MoJS).
- **Measurement Type:** Manual quarterly monitoring well depth (meters below ground level, m bgl).
- **Spatial Scope:** Pilot districts of Chhatarpur and Tikamgarh, Madhya Pradesh.

---

## 2. Ingestion Pipeline & Quality Safeguards
The ingestion logic is encapsulated in [`src/lib/services/cgwbAdapter.ts`](file:///D:/Projects/JalDrishti/src/lib/services/cgwbAdapter.ts) and [`src/lib/services/ingestionEngine.ts`](file:///D:/Projects/JalDrishti/src/lib/services/ingestionEngine.ts):

1. **Null-Preserving Validation:** Unmeasured water levels are preserved as `null`. Missing values are never converted to zero, avoiding erroneous artesian flow calculations.
2. **Coordinate Sanity Filtering:** Rejects invalid geographic coordinates outside the Bundelkhand bounding box ($23.5^\circ\text{N} - 26.5^\circ\text{N}, 78.0^\circ\text{E} - 81.0^\circ\text{E}$).
3. **Piezometer Range Checks:** Restricts water levels between $-5.0\text{ m}$ (artesian heads) and $150.0\text{ m bgl}$.
4. **Idempotent Batch Staging:** Batch records are processed using unique compound keys (`station_id + observation_date`) preventing duplicate rows upon repeated ingestion runs.

---

## 3. Findings & Operational Status
- **Parser Verification:** Unit tests in [`tests/cgwbAdapter.test.ts`](file:///D:/Projects/JalDrishti/tests/cgwbAdapter.test.ts) pass at 100%.
- **Live Display Status:** Historical observations API returns 503 on the remote database because `v_published_historical_observations` is pending permission remediation. Once applied, real CGWB observations will render directly inside `/monitoring`.
