# AMRUT DRISHTI — PROJECT DOCUMENTATION INDEX

**Last Updated:** October 23, 2026  
**Repository Location:** `F:\Projects\Amrut Drishti`  
**Purpose:** Central authoritative map of project documentation, architecture specifications, operations guides, data provenance records, and historical archives.

---

## 1. Core Project Specifications (Approved Sources of Truth)

These four documents define the scope, technical architecture, project objectives, and visual aesthetics of Amrut Drishti:

1. **Product Requirements Document (PRD v1.0):**  
   - [`Amrut Drishti_Exhaustive_PRD_v1.0.docx`](file:///f:/Projects/Amrut Drishti/Amrut Drishti_Exhaustive_PRD_v1.0.docx)  
   - *Purpose:* Defines **what** to build across all functional epics (geography, indicators, risk assessment, alerts, interventions, bilingual support).
2. **Technical Requirements Document (TRD v1.0):**  
   - [`Amrut Drishti_Exhaustive_TRD_v1.0.docx`](file:///f:/Projects/Amrut Drishti/Amrut Drishti_Exhaustive_TRD_v1.0.docx)  
   - *Purpose:* Defines **how** to build the platform (Next.js 15, TypeScript, Supabase PostGIS, Python inference architecture, scientific equations, RLS policies).
3. **Project Summary & Research Baseline:**  
   - [`Amrut Drishti SUMMARY.docx`](file:///f:/Projects/Amrut Drishti/Amrut Drishti%20SUMMARY.docx)  
   - *Purpose:* Explains **why** (Bundelkhand pilot, existing systems like India-WRIS/Bhuvan, identified research gaps, and institutional motivation).
4. **Master Design System & UI Guidelines:**  
   - [`docs/DESIGN_GUIDELINES.md`](file:///f:/Projects/Amrut Drishti/docs/DESIGN_GUIDELINES.md)  
   - *Purpose:* Master vibe-coding instructions, warm neutral palettes, restrained typography, and the strict 30 prohibited visual antipatterns.

---

## 2. Setup, Deployment & Operations

1. **System Setup & Local Development:**  
   - [`docs/SETUP_GUIDE.md`](file:///f:/Projects/Amrut Drishti/docs/SETUP_GUIDE.md) — Node/Python environment setup, dependencies, dev servers.
   - [`Readme.md`](file:///f:/Projects/Amrut Drishti/Readme.md) — Platform overview, quickstart commands, and architectural diagram.
2. **Production Deployment & Staging Runbooks:**  
   - [`audit/VERCEL_SUPABASE_MODEL_DEPLOYMENT_AUDIT.md`](file:///f:/Projects/Amrut Drishti/audit/VERCEL_SUPABASE_MODEL_DEPLOYMENT_AUDIT.md) — Deployment architecture, staging container setup, and Vercel/Supabase environment binding.
   - [`Dockerfile.web`](file:///f:/Projects/Amrut Drishti/Dockerfile.web), [`Dockerfile.model`](file:///f:/Projects/Amrut Drishti/Dockerfile.model), [`docker-compose.staging.yml`](file:///f:/Projects/Amrut Drishti/docker-compose.staging.yml) — Containerized deployment definitions.
   - [`vercel.json`](file:///f:/Projects/Amrut Drishti/vercel.json) — Vercel routing and serverless function configurations.

---

## 3. Data Provenance & Authoritative Registries

1. **Active Canonical 43-Block Scope:**  
   - [`audit/canonical_43_blocks_active.json`](file:///f:/Projects/Amrut Drishti/audit/canonical_43_blocks_active.json) — Authoritative machine-readable list of all 43 active canonical blocks.
   - [`audit/coverage_matrix_43_blocks.json`](file:///f:/Projects/Amrut Drishti/audit/coverage_matrix_43_blocks.json) — Complete multi-source coverage matrix for the 43 active blocks across 9 states.
   - [`audit/AMRUTDRISHTI_FINAL_43_BLOCK_SCOPE_REPORT.md`](file:///f:/Projects/Amrut Drishti/audit/AMRUTDRISHTI_FINAL_43_BLOCK_SCOPE_REPORT.md) — Implementation report detailing the removal of Assam and the final 43-block cohort.
2. **Global Model Block Readiness Ledger:**  
   - [`audit/global_model_block_readiness.json`](file:///f:/Projects/Amrut Drishti/audit/global_model_block_readiness.json) — Machine-readable audit ledger recording verified station mappings, observation freshness, and fail-closed readiness.
3. **Data Acquisition Runbook & Manifests:**  
   - [`docs/DATA_ACQUISITION_AND_CALIBRATION_RUNBOOK.md`](file:///f:/Projects/Amrut Drishti/docs/DATA_ACQUISITION_AND_CALIBRATION_RUNBOOK.md) — Runbook for downloading and validating NWDP/CGWB datasets.
   - [`data/ingestion_manifest.json`](file:///f:/Projects/Amrut Drishti/data/ingestion_manifest.json) — Cryptographic SHA-256 manifest of ingested data sources.
   - [`data/derived/verified_cgwb_block_series.json`](file:///f:/Projects/Amrut Drishti/data/derived/verified_cgwb_block_series.json) — Curated CGWB historical series.
   - [`data/derived/nwdp_block_telemetry_series.json`](file:///f:/Projects/Amrut Drishti/data/derived/nwdp_block_telemetry_series.json) — Official 2026 telemetry time series.

---

## 4. Machine Learning & Scientific Integrity

1. **Model Architecture & Evaluation:**  
   - [`audit/AMRUTDRISHTI_ML_EVALUATION_REPORT.md`](file:///f:/Projects/Amrut Drishti/audit/AMRUTDRISHTI_ML_EVALUATION_REPORT.md) — Evaluation of the Global Block-Aware Quantile Gradient Boosting model (`global_block_aware_qgb_v1.joblib`) against baselines.
   - [`audit/global_groundwater_model_validation.json`](file:///f:/Projects/Amrut Drishti/audit/global_groundwater_model_validation.json) — Multi-horizon evaluation metrics (1M, 3M, 6M) across persistence and ridge benchmarks.
   - [`ml/manifest.json`](file:///f:/Projects/Amrut Drishti/ml/artifacts/manifest.json) — Model artifact metadata and training hyperparameter records.
2. **Scientific Reports:**  
   - [`docs/scientific/four_workstream_execution_report_2026-10-16.md`](file:///f:/Projects/Amrut Drishti/docs/scientific/four_workstream_execution_report_2026-10-16.md) — In-depth analysis of IN-GRES classification, IMD precipitation ablation, and UP DWLR telemetry validation.
   - [`docs/scientific/cgwb_ingres_label_quality_report.md`](file:///f:/Projects/Amrut Drishti/docs/scientific/cgwb_ingres_label_quality_report.md) — Quality and stability analysis of official IN-GRES categorization labels.

---

## 5. Verification & Final Release Audits

1. **Release Blockers & Post-Completion Audits:**  
   - [`audit/AMRUTDRISHTI_POST_COMPLETION_VERIFICATION.md`](file:///f:/Projects/Amrut Drishti/audit/AMRUTDRISHTI_POST_COMPLETION_VERIFICATION.md) — Independent verification of repository integrity, canonical geography, and serving contracts.
   - [`audit/amrutdrishti_release_blockers.json`](file:///f:/Projects/Amrut Drishti/audit/amrutdrishti_release_blockers.json) — Release blocker tracking ledger.
   - [`audit/amrutdrishti_consistency_audit.json`](file:///f:/Projects/Amrut Drishti/audit/amrutdrishti_consistency_audit.json) — 100% consistency audit across all registries.
2. **Cleanup & Maintenance Reports:**  
   - [`audit/REPOSITORY_CLEANUP_INVENTORY.md`](file:///f:/Projects/Amrut Drishti/audit/REPOSITORY_CLEANUP_INVENTORY.md) — Baseline repository asset inventory.
   - [`audit/REPOSITORY_CLEANUP_PLAN.md`](file:///f:/Projects/Amrut Drishti/audit/REPOSITORY_CLEANUP_PLAN.md) — Repository cleanup plan and execution log.

---

## 6. Historical Archive (`docs/archive/`)

The archive retains important historical context, superseded investigations, and raw exploration material without cluttering the active development path:

| Archive Folder | Contents |
|:---|:---|
| `docs/archive/investigation_audits/` | Intermediate investigations (NWDP source trace, 400-day root cause, API discovery, dual-source coverage). |
| `docs/archive/legacy_app_src/` | Pre-migration prototype application code (superseded by `src/`). |
| `docs/archive/legacy_src_new/` | Temporary initial scaffold containing obsolete type definitions. |
| `docs/archive/nwdp_discovery_dumps/` | Static HTML/JS scraped pages from the national data portal used during dataset discovery. |
| `docs/archive/legacy_scripts_data/` | Intermediate empirical statistics dumps (`all_48_contrast_real_stats.json`, etc.). |
| `docs/archive/extracted_texts/` | Plaintext extractions of the master Word documents. |
| `docs/archive/config_backups/` | Pre-migration TypeScript and Tailwind configuration snapshots. |
| `docs/audit/` | Sprint audit files from the October 10–16 development cycle. |
| `audit/2026-10-16-e2e-release-audit/` | Complete 16-chapter report from the October 16 end-to-end evaluation. |
