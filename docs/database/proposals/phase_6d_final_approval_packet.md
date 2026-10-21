# JAL DRISHTI — PHASE 6D FINAL APPROVAL PACKET

**Date:** 21 October 2026 · **Project:** `gejsibmhqwqrqukewqpi` (ref confirmed from the configured URL; no secrets printed)
**Status:** `BLOCKED — PRE-CHANGE SNAPSHOT NOT OBTAINABLE FROM THIS ENVIRONMENT` (SQL is review-ready; execution must not proceed until the owner supplies snapshot A–E and confirms a backup)
**No remote changes were made.** Only read-only REST requests were issued.

## 1. Read-only snapshot results

Queries A–E (ACLs, column grants, RLS flags/owners/view options, default ACLs, policies) **could not be run**.
Evidence of why (`scripts/check_snapshot_interface.cjs`):
- PostgREST returns HTTP 404 for `pg_policies`, `pg_class` and `pg_default_acl`; catalogs are not exposed.
- No `psql` or `supabase` CLI is installed, and `.env.local` holds no database URL or management access token (names only: anon key, project URL, service-role key, EARTHDATA_TOKEN, DATA_GOV_IN_API_KEY).
- I did not invent results. Missing evidence: table ACLs, column grants, RLS flags, policy definitions, default ACLs, and the view's definition, owner and security mode. **The owner must run A–E in the SQL Editor and return the output.**

What *was* observed through the API (behavioural, not ACL metadata):

| Probe | anon | service_role |
|---|---|---|
| `administrative_units`, `derived_indicators`, `data_sources`, `schemes` | 200 | 200 |
| `v_published_historical_observations` | 200, 9595 rows, all `published/observed` | 9595 |
| `monitoring_stations`, `station_observations`, `model_predictions`, `model_registry`, `intervention_*`, `notification_records`, `ingestion_runs`, `audit_events`, `profiles` | 401 (42501) | 200 |
| `station_observation_lineage` | denied | 9595 |
| `observation_ingestion_batches` (new finding) | denied | 1 |
| anon `POST administrative_units` | 401 (42501) | n/a |
| PostGIS: `spatial_ref_sys` SRID 4326 | readable | readable |
| PostGIS: `geometry_columns` | 2 rows | 3 rows |

Inference (labelled as inference): the anon-readable view over anon-denied tables implies the view runs with owner rights. Confirm via query C (`reloptions`, owner).

Not provable via the API: `authenticated` ACLs, whether 000002's **policy** replacements were applied (anon 401s are grant-based and would look the same either way), and RLS flags. The Phase 6C statement "already applied" is therefore verified for grants only.

New facts found this run:
- `observation_ingestion_batches` is exposed remotely, in no local migration, and was missing from Revision 2. It is now covered by a guarded revoke-only step.
- `rls_auto_enable` and ~300 PostGIS `st_*` functions are exposed as RPC endpoints. Function EXECUTE exposure is out of scope for this migration. I did not call `rls_auto_enable` (side effects). Flagged for a separate review.
- anon calls to `current_user_role` and `current_user_district` return `null` without error, as expected.

## 2. Line-by-line SQL review

File: `supabase/migrations/20261021000000_least_privilege_remediation.sql`, 101 lines.
**SHA-256: `3F3246E426B7C6DBF20EF4D75F9F9A0EAED0FD90A7FEFF98B2B3E010ED7E5AB4`**
(The Revision 2 hash `60558975…1BE`, 96 lines, is superseded.)

| Block | Review result |
|---|---|
| Header comments | Accurate scope and exclusions. |
| `BEGIN` / `COMMIT` | One transaction. An error aborts cleanly. It is not a post-commit rollback. |
| Pre-flight `DO` | Raises if any of the 14 tables is missing; read-only. All 14 appear in the PostgREST schema. |
| `REVOKE ALL … FROM anon, authenticated` (14 tables) | Table-level only; columns untouched; version-safe for `MAINTAIN`. Requires `postgres` to own the tables (query C). Failure aborts everything. |
| Guarded revoke, lineage + ingestion batches | Revoke-only. No grants added. Both are unused by app code. Intended access is via the owner-rights view and the service role. Revise only if the snapshot shows `authenticated` legitimately needs them; none is evident. |
| `GRANT SELECT` four catalogues to anon+authenticated | Matches the public map and catalogue code paths. |
| `GRANT SELECT` seven operational tables to authenticated | Matches migration 000002. Anon stays denied, as observed. |
| `intervention_proposals` S/I/U, `profiles` S/U, `audit_events` S/I | Option A (see section 4). No DELETE anywhere. |
| `GRANT USAGE ON SCHEMA public` | Already held. Idempotent no-op. |
| Not touched | RLS policies and flags, functions, sequences (none exist), PostGIS objects, the view, `service_role`, data, ownership. |
| Gated default-ACL block | Entirely commented out. Not executed. |

Cautions that remain:
1. The view row in the verification allowlist (`authenticated` SELECT) is an assumption. If snapshot A shows authenticated lacks SELECT on the view, a logged-in session already fails there today. The migration does not change that, but the allowlist would report `MISSING`. Adjust the allowlist to the snapshot, not the grants.
2. `REVOKE ALL` does not clear column-level grants (query B).
3. Un-migrated drift (view definition, two tables) should be captured in a future migration under separate approval.

Verification allowlist: it matches the approved model exactly for the 14 tables. The lineage and batches tables have no allowed entries, so any leftover grant is reported as `EXCESS`.

## 3. Backup and recovery status

- **Backup confirmation: NONE. I have no evidence a backup or PITR point exists.** The owner must confirm and state the Supabase plan and the backup timestamp or PITR window.
- Record the snapshot A–E output before execution. It is the only source of the original ACLs, and restore statements come from query A.
- Post-commit recovery: replay the saved query A statements after `REVOKE ALL` on the target tables (plan section 6). It restores the original, wider grants, so treat it as a short-term unblock.

## 4. Option A vs Option B (not chosen, not applied)

Evidence from code inspection:
- The only database writes in `src/` are `upsert` on `intervention_proposals` (`api/interventions/route.ts:203`) and `insert` on `audit_events` (`api/audit/route.ts:173`). Both use the **service-role** client.
- No code writes to `profiles`; signup uses the SECURITY DEFINER trigger.
- Browser and server anon-key clients only read `administrative_units`, `derived_indicators`, and the published view.
- So no current code path needs authenticated table writes.

| | A: keep authenticated writes | B: remove them |
|---|---|---|
| Grants | `intervention_proposals` S/I/U, `profiles` S/U, `audit_events` S/I | `intervention_proposals` S, `profiles` S, `audit_events` S |
| Effect today | None; matches 000002 | None; identical app behaviour |
| Attack surface | Authenticated users could write directly via REST, bounded only by RLS | Writes only through server routes |
| Cost | A future client write path works without a migration | A future client write path needs an explicit grant migration |

**Recommendation: Option B**, on least-privilege grounds and because the evidence shows no client write path. Option A is acceptable if the owner wants compatibility with the reviewed 000002 design.
Option B diff against the checksummed SQL:
```diff
-GRANT SELECT, INSERT, UPDATE ON TABLE public.intervention_proposals TO authenticated;
-GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
-GRANT SELECT, INSERT ON TABLE public.audit_events TO authenticated;
+GRANT SELECT ON TABLE public.intervention_proposals, public.profiles, public.audit_events TO authenticated;
```
and remove the corresponding `INSERT`/`UPDATE` rows from the verification allowlist. Selecting B produces a new file and checksum, which must be re-approved. I applied neither option.

## 5. Remaining blockers

1. Snapshot A–E not supplied (no catalog access from this environment).
2. Backup or PITR not confirmed.
3. Owner choice of Option A or B.
4. Policy-level state of 000002 unverified until query E.
5. Default privileges unresolved until query D (gated block stays off).
6. Function EXECUTE exposure (`rls_auto_enable`, PostGIS RPCs) is out of scope and unreviewed.

## 6. Statement

**No remote changes were made.** No SQL was executed, no migration applied, no grants modified, and nothing committed, pushed or deployed. New local files: `scripts/check_snapshot_interface.cjs`, `scripts/check_extra_tables_status.cjs`, and this packet. The migration SQL was revised locally only.
**Awaiting the owner's explicit approval of the exact SQL with the SHA-256 above, or a requested Option B revision.**
