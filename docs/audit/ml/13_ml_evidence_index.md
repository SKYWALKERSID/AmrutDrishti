# JAL DRISHTI — ML Evidence Index
**Audit Date**: October 13, 2026  
**Document**: `13_ml_evidence_index.md`  

---

## 1. Concrete Evidence Index & Artifact Pointers

This index references every concrete code file, dataset, database table, command execution, and test output used to support the findings of this audit.

### A. Source Code & Pipeline Implementations
- **ML Model Architectures**: [`ml/models.py`](file:///d:/Projects/JalDrishti/ml/models.py) (Lines 14–80: `QuantileGroundwaterModel`)
- **Neural Network Architecture**: [`ml/lstm_model.py`](file:///d:/Projects/JalDrishti/ml/lstm_model.py) (Lines 17–55: `GroundwaterLSTM`)
- **Feature Engineering**: [`ml/feature_engineering.py`](file:///d:/Projects/JalDrishti/ml/feature_engineering.py) (Lines 16–112: `load_cgwb_groundwater_raw`, `clean_and_harmonize_observations`, `build_block_training_matrix`)
- **Baselines & Metrics**: [`ml/baselines.py`](file:///d:/Projects/JalDrishti/ml/baselines.py) (Lines 19–80: `calculate_hydrological_metrics`, `SeasonalPersistenceBaseline`)
- **Training Orchestration**: [`ml/train.py`](file:///d:/Projects/JalDrishti/ml/train.py) (Lines 22–206: Walk-forward validation loop)
- **Forecast API Route**: [`src/app/api/forecast/route.ts`](file:///d:/Projects/JalDrishti/src/app/api/forecast/route.ts) (Lines 38–76: Hardcoded fixture offsets)
- **Frontend Visualization**: [`src/app/monitoring/page.tsx`](file:///d:/Projects/JalDrishti/src/app/monitoring/page.tsx) (Lines 120–135 & 290–330: Forecast chart rendering)

### B. Datasets & Checksums
- **Raw CGWB Observations**: `data/sources/cgwb_mp_cleaned_proper.csv` (1,866,128 bytes, 13,090 rows, 21 columns)
- **Live Satellite Script**: `scripts/cron_live_satellite_ingest.py` (Copernicus Sentinel-2, NASA SMAP, IMD ingestion)

### C. Database Tables & Records (Supabase `gejsibmhqwqrqukewqpi`)
- **Model Registry**: `public.model_registry` (Registered ID: `quantile_gb_v1.0`)
- **Model Predictions**: `public.model_predictions` (Populated with $P_{10}, P_{50}, P_{90}$ forecast rows for all 6 blocks)
- **Derived Indicators**: `public.derived_indicators` (Populated with live Sentinel-2 NDVI/NDWI and NASA SMAP metrics)

### D. Reproducible Command Executions
- **ML Training Execution**:
  ```bash
  python -m ml.train --mode train
  # Exit code: 0, Duration: 8.1s, Output: 6 blocks trained, 6 predictions inserted
  ```
- **Automated Test Suite**:
  ```bash
  npm test
  # Exit code: 0, Duration: 629ms, Output: 134 passed, 0 failed
  ```
- **Next.js Production Build**:
  ```bash
  npm run build
  # Exit code: 0, Duration: 2.3s, Output: 11/11 static pages generated
  ```
