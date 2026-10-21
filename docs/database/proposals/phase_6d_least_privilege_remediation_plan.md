# JAL DRISHTI — PHASE 6D REMEDIATION PLAN (Revision 2)

**Status:** `PLAN READY FOR OWNER APPROVAL` (nothing executed against Supabase)
**Project:** `gejsibmhqwqrqukewqpi`
**SQL:** `supabase/migrations/20261021000000_least_privilege_remediation.sql`
Revision 2 supersedes Revision 1. Revision 1 contained unverified claims; see "Corrections".

## 1. Corrections to Revision 1

| # | Revision 1 problem | Fix |
|---|---|---|
| 1 | "Current ACL" columns stated `ALL/TRUNCATE` without a captured ACL. | Removed. Pre-change ACLs must be captured by the snapshot query (section 5) before approval is final. The REST API cannot read `relacl`. |
| 2 | `GRANT USAGE ON ALL SEQUENCES ... TO authenticated`. | Removed. The init schema has no sequences (TEXT keys, `uuid DEFAULT gen_random_uuid()`); a grep of migrations found none. |
| 3 | `GRANT SELECT` on `spatial_ref_sys`, `geometry_columns`, `geography_columns`. | Removed. Those are extension-owned. `postgres` may not own them, so the GRANT could abort the whole transaction, and anon read already works. Left untouched. |
| 4 | Re-granted `v_published_historical_observations`. | Removed. Not revoked, so no re-grant is needed. |
| 5 | Default-privilege revokes for `postgres` and `supabase_admin` applied unconditionally. | Moved to a commented, gated block. Not proven excessive by evidence I hold, and `FOR ROLE supabase_admin` normally errors from the SQL editor. Function defaults are never touched. |
| 6 | Rollback script restored a guessed baseline. | Replaced by a snapshot-and-replay procedure (section 6). |
| 7 | Verification demanded zero `DELETE`/`TRIGGER`/etc. globally. | Replaced with a per-table allowlist diff (section 7). |
| 8 | Unreviewed table `station_observation_lineage` was ignored. | It exists remotely but in no local migration. The SQL now revokes (only) anon/authenticated on it if present. |

## 2. Evidence gathered this run (read-only, no secrets printed)

Probe: `scripts/check_view_invoker_status.cjs`.

| Object | anon | service_role |
|---|---|---|
| `v_published_historical_observations` | OK, 9595 rows, all `published/observed` | OK, 9595 |
| `station_observation_lineage` | denied | OK, 9595 |
| `station_observations` | denied | OK, 9595 |
| `monitoring_stations` | denied | OK, 431 |

- **Finding on `security_invoker`:** anon reads the view but not its underlying tables. A `security_invoker=true` view would fail for anon. So the remote view runs with owner rights, which differs from the local proposal file (`docs/database/proposals/202610_historical_observation_publication_view.sql`, `security_invoker = true`). No underlying grants are needed or proposed. Re-applying that proposal file as written would break the public endpoint. Confirm the actual definition with the query in section 5 (`reloptions`, owner).
- **Consequence:** the view exposes 9595 rows publicly by owner rights, bounded only by its own `WHERE` clause. That matches the stated intent, but it bypasses the RLS on the raw tables.
- PostGIS: `geometry_columns` shows anon 2 rows vs service 3 rows. It filters by table privilege, which is consistent with anon having no access to `monitoring_stations`. `spatial_ref_sys` (SRID 4326) reads fine for anon. Not modified.
- Code usage of tables (`.from(...)` in `src`):
  - Browser/anon-key server clients (anon or authenticated session): `administrative_units`, `derived_indicators`, `v_published_historical_observations`.
  - Service-role only (server routes): `intervention_proposals`, `audit_events`.
  - No code path writes through the `authenticated` role today.

## 3. Workflow check (grant → requirement)

| Workflow | Needs | Preserved? |
|---|---|---|
| Public map (`/api/geospatial/blocks`) | anon/auth SELECT `administrative_units`, `derived_indicators` | Yes |
| Historical observations | anon/auth SELECT on the view (untouched) | Yes |
| Data sources, schemes catalogues | anon/auth SELECT | Yes |
| Interventions API, audit API | service_role (untouched) | Yes |
| Authenticated proposals (RLS design) | SELECT/INSERT/UPDATE `intervention_proposals`, no DELETE | Yes (kept per 000002) |
| Profiles self-update | SELECT/UPDATE `profiles`; signup uses SECURITY DEFINER trigger | Yes |
| Audit append | SELECT/INSERT `audit_events` | Yes |
| RLS helper functions | EXECUTE on `current_user_role()`/`current_user_district()` | Untouched |

Table-level `REVOKE ALL` then re-grant, in one transaction, means no intermediate state is visible to other sessions.

## 4. Remaining risks

1. **Authenticated writes are unused by current code.** The grants are kept to match reviewed migration 000002. Owner may prefer removing `INSERT, UPDATE` on `intervention_proposals`, `UPDATE` on `profiles`, and `INSERT` on `audit_events` until a client path needs them (stricter, no functional loss today).
2. **Column-level grants** are not removed by `REVOKE ALL ON TABLE`. Check in section 7.
3. **Pre-change ACLs unknown to me.** The expected "after" state is exact; the "before" state must be captured.
4. **View definition drift** (remote differs from local proposal) and **`station_observation_lineage` drift** are un-migrated. Document them in a migration later (separate approval).
5. **Authenticated-role behaviour is untested.** No test account is available. Use the `SET ROLE` checks below.
6. **Default privileges unresolved.** Future tables created by `postgres`/`supabase_admin` may still auto-grant to anon/authenticated until the gated block is approved with evidence.
7. **Ownership:** if `postgres` does not own a table, its `REVOKE` fails. That aborts the transaction cleanly with no change.
8. **Backups:** daily/PITR backups depend on the Supabase plan. Owner must confirm one exists.

## 5. Pre-change capture (read-only; run in SQL editor, save output)

```sql
-- A. Replayable restore statements for anon/authenticated/PUBLIC table ACLs
SELECT format('GRANT %s ON TABLE %I.%I TO %s;', a.privilege_type, n.nspname, c.relname,
       CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END) AS restore_stmt
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(c.relacl) a
LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p','f')
  AND (a.grantee = 0 OR r.rolname IN ('anon','authenticated'))
ORDER BY 1;

-- B. Column-level grants (should be empty)
SELECT c.relname, att.attname, att.attacl
FROM pg_attribute att JOIN pg_class c ON c.oid = att.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND att.attacl IS NOT NULL AND att.attnum > 0;

-- C. Object types, owners, view options, RLS flags
SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner, c.reloptions,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p','f') ORDER BY 1;

-- D. Default privileges (decides the gated block)
SELECT pg_get_userbyid(defaclrole) AS creator, defaclobjtype, defaclacl
FROM pg_default_acl WHERE defaclnamespace = 'public'::regnamespace;

-- E. Policies snapshot
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2;
```

## 6. Backup and recovery

Before execution:
1. Owner confirms a recent Supabase backup or PITR point exists (state plan tier), or runs `supabase db dump --schema public` and stores it outside the repo (never commit it).
2. Save outputs of queries A–E above.

If the transaction errors: automatic rollback, nothing changed. Stop and report.

If a regression appears after COMMIT (a transaction does not undo a committed change):
```sql
BEGIN;
REVOKE ALL ON TABLE <the 14 tables + station_observation_lineage> FROM anon, authenticated;
-- paste saved restore_stmt lines from query A
COMMIT;
```
This restores the exact pre-change ACLs and re-opens the excess privileges, so use it only as a short-term unblock and open an incident. For a narrow functional regression, prefer a single targeted `GRANT SELECT` for the affected object, approved separately. Do not restore broad policies on operational tables.

## 7. Verification queries (post-change; per-table allowlist)

```sql
WITH allow(tbl, grantee, priv) AS (VALUES
 ('administrative_units','anon','SELECT'),('administrative_units','authenticated','SELECT'),
 ('data_sources','anon','SELECT'),('data_sources','authenticated','SELECT'),
 ('schemes','anon','SELECT'),('schemes','authenticated','SELECT'),
 ('derived_indicators','anon','SELECT'),('derived_indicators','authenticated','SELECT'),
 ('monitoring_stations','authenticated','SELECT'),
 ('station_observations','authenticated','SELECT'),
 ('model_predictions','authenticated','SELECT'),
 ('model_registry','authenticated','SELECT'),
 ('intervention_recommendations','authenticated','SELECT'),
 ('notification_records','authenticated','SELECT'),
 ('ingestion_runs','authenticated','SELECT'),
 ('intervention_proposals','authenticated','SELECT'),
 ('intervention_proposals','authenticated','INSERT'),
 ('intervention_proposals','authenticated','UPDATE'),
 ('profiles','authenticated','SELECT'),('profiles','authenticated','UPDATE'),
 ('audit_events','authenticated','SELECT'),('audit_events','authenticated','INSERT'),
 ('v_published_historical_observations','anon','SELECT'),
 ('v_published_historical_observations','authenticated','SELECT')),
actual AS (
 SELECT c.relname AS tbl,
        CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE r.rolname END AS grantee,
        a.privilege_type AS priv
 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 CROSS JOIN LATERAL aclexplode(c.relacl) a LEFT JOIN pg_roles r ON r.oid = a.grantee
 WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p','f')
   AND (a.grantee = 0 OR r.rolname IN ('anon','authenticated'))
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass
                   AND d.objid = c.oid AND d.deptype = 'e'))   -- exclude PostGIS objects
SELECT coalesce(a.tbl, w.tbl) AS tbl, coalesce(a.grantee, w.grantee) AS grantee,
       coalesce(a.priv, w.priv) AS priv,
       CASE WHEN w.tbl IS NULL THEN 'EXCESS' ELSE 'MISSING' END AS problem
FROM actual a FULL JOIN allow w
  ON a.tbl = w.tbl AND a.grantee = w.grantee AND a.priv = w.priv
WHERE a.tbl IS NULL OR w.tbl IS NULL;
-- Expected: 0 rows. The view rows are in the allowlist only if they exist before/after as today.
```
Also run: query B (expect empty), query C (all 14 tables `relrowsecurity = true`, unchanged), query E diffed against the saved snapshot (expect identical), and PostGIS ACLs listed separately (expect unchanged vs. before).

Behavioural checks:
- Anon HTTP: SELECT on `administrative_units`, `derived_indicators`, `data_sources`, `schemes`, the view returns 200; the 10 restricted tables return 401/42501 (`scripts/check_anon_status.cjs`); POST/TRUNCATE-class mutations denied (`scripts/test_anon_mutation.cjs`).
- `scripts/check_postgis_status.cjs`: anon `spatial_ref_sys` 4326 read, `geometry_columns` row count unchanged (2).
- `scripts/check_view_invoker_status.cjs`: view still 9595 rows, only `published/observed`.
- `/api/geospatial/blocks` returns `source: live_database`.
- Authenticated (SQL editor, test user UUID): `SET ROLE authenticated; SET request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';` then confirm district scoping on `intervention_proposals`, self-only `profiles` update, audit INSERT only with `actor_id = auth.uid()`, and `DELETE`/`UPDATE` on `audit_events` denied (42501).
- Then `npm test`, `python -m pytest tests_py/`, `npx tsc --noEmit`, `npm run build`.

## 8. Approval gate

No SQL was run. Execution requires the owner to (1) approve this exact revision, (2) confirm the backup, (3) supply or run snapshot queries A–E, and (4) decide on risk items 1 and 6.
