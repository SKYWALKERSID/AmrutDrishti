# JalDrishti — Phase Five: Database & Supabase Security Audit

**Document File:** `docs/audit/05_database_supabase_security.md`  
**Audited Target:** `supabase/migrations/` and remote project `gejsibmhqwqrqukewqpi`

---

## 1. Migration Ledger Inspection

1. **`20261010000000_init_schema.sql` (14,873 bytes)**
   - Creates extensions (`uuid-ossp`, `postgis`).
   - Defines enums (`user_role_enum`, `risk_severity_enum`, `data_status_enum`, `proposal_status_enum`).
   - Creates 14 core tables with PostGIS geometries, foreign keys, and indexes.
   - Enables Row Level Security (RLS) across all tables.
   - **Root Cause Identified:** Enabled RLS and created policies, but omitted SQL `GRANT SELECT` statements. In PostgreSQL, missing grants yield code 42501 before RLS policies are even evaluated.
2. **`20261010000001_grant_public_read_permissions.sql` (1,367 bytes)**
   - Added initial `GRANT SELECT` on public reference tables.
3. **`20261011000002_permissions_remediation.sql` (10,832 bytes) — PENDING EXECUTION**
   - Consolidated, hardened SQL grants and RLS policy tightening.
   - Grants `anon` read access only to public reference tables (`administrative_units`, `data_sources`, `schemes`, and published rows of `derived_indicators`).
   - Restricts `monitoring_stations`, `station_observations`, `intervention_proposals`, and `audit_events` to authenticated sessions with district scoping.
   - **Status:** Passes all unit test assertions in [`tests/databaseAuthorization.test.ts`](file:///D:/Projects/JalDrishti/tests/databaseAuthorization.test.ts); awaits execution by DB owner on remote Supabase.

---

## 2. Row Level Security (RLS) Posture

| Database Object | Type | RLS Enabled | Anon Access | Authenticated Access | Security Assessment |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `administrative_units` | Table | YES | SELECT | SELECT | Public boundary data; safe. |
| `data_sources` | Table | YES | SELECT | SELECT | Public metadata registry; safe. |
| `schemes` | Table | YES | SELECT | SELECT | Public government schemes; safe. |
| `derived_indicators` | Table | YES | SELECT (published only) | SELECT (all) | Restricted to `publication_status = 'published'`. |
| `monitoring_stations` | Table | YES | NONE | SELECT | Authenticated only. |
| `station_observations` | Table | YES | NONE | SELECT | Authenticated only. |
| `intervention_proposals` | Table | YES | NONE | SELECT, INSERT, UPDATE | Scoped by user role and district jurisdiction. |
| `profiles` | Table | YES | NONE | SELECT, UPDATE | Scoped; users can update own profile only. |
| `audit_events` | Table | YES | NONE | SELECT, INSERT | Append-only; zero DELETE/UPDATE grants. |

---

## 3. Database Vulnerability & Risk Summary
- **Zero DELETE Grants:** The application role possesses zero `DELETE` privileges across any production tables, preventing catastrophic accidental data loss.
- **Search Path Isolation:** All `SECURITY DEFINER` database helper functions explicitly define `SET search_path = pg_catalog, public` to eliminate search-path hijacking attacks.
- **Immediate Remediation Required:** The remote database requires execution of `20261011000002_permissions_remediation.sql` within a transaction (`BEGIN; ... COMMIT;`).
