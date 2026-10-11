# JAL DRISHTI — Security & Dependency Audit Report (JD-046)

**Operating Date:** 2026-10-11  
**Task ID:** JD-046 (`Stage 11: Governance, security & operations`)  
**Task Description:** Current dependency audit triaged; secrets protected; no sensitive data exposed; threat model addressed.  
**Status:** TRIAGED & LOCALLY EVIDENCED  

---

## 1. Secret Protection & Environment Variable Inspection

### Static Code & Configuration Analysis
1. **`.env` files:**
   - Git tracking status checked via `git status --short`. Neither `.env` nor `.env.local` is tracked by git.
   - `.gitignore` enforces exclusion of `.env*` local files while maintaining template patterns.
2. **API Keys & Credentials:**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is utilized strictly for public data queries.
   - `SUPABASE_SERVICE_ROLE_KEY` is **NOT embedded anywhere** in client-side code, Next.js bundle bundles, or public repository files.
   - Application degrades cleanly to local mock fixtures (`demonstration_fixture`) when remote Supabase credentials are missing or unconfigured.
3. **Sensitive Data Exposure & PII Minimization:**
   - Verified that `governanceService.ts` contains `redactPhoneNumber()` to mask phone numbers (`+91 94251 *****`).
   - Notification records enforce role- and district-scoping in SQL RLS policies.

---

## 2. Dependency Vulnerability Triage (npm audit)

### Execution Output Summary
- **Command:** `npm audit --json`
- **Total Vulnerabilities:** 9 (3 moderate, 6 high, 0 critical)
- **Direct Dependencies Flagged:**
  1. `tailwindcss` (via `postcss-selector-parser`, `postcss-nested`, `micromatch`, `chokidar`, `braces`)
  2. `next` (via bundled `postcss` source map parsing advisory)

### Detailed Threat Triage & Risk Assessment

| Package | Advisory ID / CVE | Severity | Context & Impact Analysis | Triage Decision & Action |
|---|---|:---:|---|---|
| `braces` / `micromatch` | GHSA-vfj7-8cjw-p6xm (CWE-674) | High | Transitive devDependency inside `tailwindcss` file watching (`chokidar`). Only runs during local development build/file-watching. Not exposed in the production runtime bundle or HTTP request handlers. | **Documented & Deferred:** Upgrading requires `tailwindcss@4`, which introduces breaking configuration and CSS syntax changes. Since it affects only local build tooling, risk in production runtime is low. |
| `postcss-selector-parser` | GHSA-rj75-hqrm-r3gf (CWE-400) | Moderate | Flat selector parsing CPU exhaustion in PostCSS build step. Build-time only; not evaluated dynamically on untrusted user-supplied CSS strings. | **Documented & Deferred:** Build-time only; input CSS is static developer-authored files. |
| `postcss` (via `next`) | GHSA-qx2v-qp2m-jg93 / GHSA-6g55-p6wh-862q | Moderate / High | XSS in `</style>` stringify output and path traversal in source map auto-loading. | **Documented & Deferred:** Next.js is locked at `15.1.0`. `npm audit fix --force` attempts to jump to `next@16.4.0` (semver major breaking change). Upgrading to Next.js 16 would break React 19 compatibility and routing conventions. Recommended for scheduled maintenance window. |

### Summary for Project Stakeholders
No remote code execution (RCE) or sensitive token exfiltration vulnerability exists in production runtime dependencies. All flagged advisories are confined to build-time CSS compilation and local dev-server file watching. Running `npm audit fix --force` is explicitly **rejected** at this stage because it would forcefully install breaking major versions (`tailwindcss@4` and `next@16`).

---

## 3. Threat Model Summary (PRD §5 / TRD §8 Compliance)

1. **Authentication Bypass Threat:** Mitigated by server-side `authorizeAction` in `governanceService.ts` and Supabase RLS policies.
2. **Cross-District Mutation Threat:** Mitigated by district-scoping policies on `intervention_proposals` and block-to-district referential validation in `20261011000002_permissions_remediation.sql`.
3. **Audit Trail Tampering Threat:** Mitigated by append-only policies on `audit_events` (zero `UPDATE` / `DELETE` grants).
4. **PII Harvesting Threat:** Mitigated by phone masking and RLS restricting notification queries to the recipient phone or district authority.
