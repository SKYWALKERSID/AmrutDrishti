# JalDrishti — Phase Seventeen: Documentation & Repository Hygiene Audit

**Document File:** `docs/audit/17_documentation_repository_audit.md`

---

## 1. Documentation Inventory & Quality
- **Core Product Documentation:**
  - `JalDrishti_Exhaustive_PRD_v1.0.docx`: Defines complete product scope, governance workflows, and advisory policies.
  - `JalDrishti_Exhaustive_TRD_v1.0.docx`: Outlines hardened architecture, PostGIS schema, and RLS specifications.
  - `JalDrishti SUMMARY.docx`: Contextualizes research background, Bundelkhand water distress, and institutional linkages.
- **Engineering Runbooks:**
  - `docs/SETUP_GUIDE.md`: Standardized setup instructions.
  - `docs/database/remote-deployment-runbook.md`: Detailed step-by-step SQL migration instructions with pre-flight checklist.
  - `docs/scientific/pilot_block_indicator_specification.md`: Mathematical definitions of SPI-3 and composite stress scores.

---

## 2. Repository Hygiene Findings
- **Clean Untracked State:** Git status reveals only temporary lock/office artifacts (`~$JalDrishti_Master_Deliverables_Checklist.xlsx`).
- **Ignored Artifacts:** `.env.local`, `.next/`, `node_modules/`, and build caches are properly excluded by `.gitignore`.
- **Legacy Directories:** Older directory `app_src/` and `src_new/` exist alongside `src/`.
  - *Recommendation:* Archive or consolidate `app_src/` and `src_new/` into documentation branches after verifying full migration into `src/`.
