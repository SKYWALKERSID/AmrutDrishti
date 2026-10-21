# JAL DRISHTI — Stage 6 Decision Report (Database Review and Showcase Readiness)

**Date:** 21 October 2026 · **Project ref:** `gejsibmhqwqrqukewqpi`
**Verdict: `REVIEW REQUIRED BEFORE PUBLIC SHOWCASE`**
The Phase 6D migration itself is **not required** for the showcase and can be deferred. The verdict is driven by a separate application-layer finding (section 3, R1).
**No remote changes were made.** No SQL executed, no migration applied, no grants/RLS/functions/data changed, nothing committed, pushed or deployed. Remote activity was limited to the probes listed in section 1.

## 1. Evidence classes

### Confirmed facts (re-checked this run)
- Migration SHA-256 recalculated: `3f3246e426b7c6dbf20ef4d75f9f9a0eaed0fd90a7feff98b2b3e010ed7e5ab4` (identical to the packet; 101 lines; unchanged).
- `.env.local` is gitignored and untracked; only `.env.example` is tracked. No `NEXT_PUBLIC_` variable holds a service or secret key. `SUPABASE_SERVICE_ROLE_KEY` is read only server-side (`src/lib/supabase/serviceClient.ts`, used by `api/interventions` and `api/audit`).
- Anonymous write attempts on all 14 init-schema tables (`scripts/check_public_exposure.cjs`, `scripts/check_anon_update_grant.cjs`): INSERT, UPDATE and DELETE return 401 / SQLSTATE 42501 on every table.
  - Note: an empty-body PATCH returned 204 on the four catalogue tables. A follow-up PATCH with a real column and a zero-row key returned 42501 on all four, so that 204 is PostgREST empty-body behaviour (it only needs SELECT), **not** an UPDATE grant.
- Anonymous reads: four catalogue tables 200; `v_published_historical_observations` 200 with 9595 rows, all `published/observed`; the ten restricted tables, `station_observation_lineage` and `observation_ingestion_batches` denied.
- Behaviour of exposed RPC functions: anon `rpc/postgis_version` returns the version string (read-only). anon `rpc/current_user_role` and `current_user_district` return `null` (no session). Application code makes no `.rpc()` calls.
- Local functions/triggers: only `current_user_role`, `current_user_district`, `handle_new_user` (all SECURITY DEFINER with a pinned `search_path`) and trigger `on_auth_user_created`.
- Supabase auth settings (public endpoint): `disable_signup = false`, email provider enabled, `mailer_autoconfirm = false`.
- The app has no sign-in UI (the only `supabase.auth` call in `src/` is `getUser()` in middleware).
- Only DB writes in `src/`: `upsert` on `intervention_proposals` and `insert` on `audit_events`, both with the service-role client.

### Antigravity-reported, not independently re-verified
- Owner-collected ACL/default-privilege output showing `TRUNCATE`/`TRIGGER`/`REFERENCES`/`MAINTAIN` for `anon`/`authenticated` (I have not seen this output).
- Phase 6C "already applied" (verified for grants only).
- 208/209 Node tests, 84 pytest, tsc, build passing (re-run earlier in this conversation; not re-run this step).

### Assumptions
- The published view runs with owner rights (inferred from anon reading it while denied on its underlying tables).
- Remote RLS policies match local migrations 000000 and 000002. The anon 401s are grant-based and do not prove this.

### Unresolved (cannot be determined from here)
Snapshot queries A–E (no catalog access, no DB URL or token, no `psql`/`supabase` CLI); the backup or PITR state; the actual deployed Vercel URL and its environment variables; whether `rls_auto_enable` is executable by anon.

## 2. Is Phase 6D needed for the showcase? — Defer

- Public (anon) exposure is already least-privilege by observation: reads limited to catalogue data plus the published view, and no anon write path exists on any known table.
- The reported excess privileges (`TRUNCATE`, `TRIGGER`, `REFERENCES`, `MAINTAIN`) are **not reachable through the REST API**. PostgREST does not expose them.
- Excess authenticated DML is bounded by RLS and requires a signed-in session; see R1/R2.
- Hardening value is real but not showcase-blocking, and executing a privilege migration without the snapshot and a confirmed backup would add risk to a working demo.

## 3. Concrete risks

| ID | Risk | Evidence | Severity for showcase |
|---|---|---|---|
| **R1** | **Self-asserted role can reach service-role writes.** `getServerUserContext` takes the role from `app_metadata.role`, falling back to `user_metadata.role` (`serverAuth.ts` lines 55–56). `user_metadata` is user-editable. Signup is open (`disable_signup=false`). Authorised routes then write with the service role (RLS bypass): `api/interventions` POST upserts proposals and `api/audit` POST inserts rows. | Code read in full for `serverAuth.ts` and `interventions/route.ts` POST. **Not exploited or tested**, because creating an account would be a remote write. Email confirmation (`mailer_autoconfirm=false`) slows but does not stop it. | **High (code-confirmed, behaviour untested)** |
| R2 | Direct-REST writes by any signed-up user via `authenticated` grants (Option A): audit rows with arbitrary actor_role/action/details (RLS only checks `actor_id = auth.uid()`), self-profile updates. | Grants per migration 000002 (reviewed); RLS state unverified. | Medium, depends on open signup |
| R3 | RLS correctness unverified (policies not readable). | Catalog not exposed. | Unknown |
| R4 | Un-migrated remote objects: two tables, plus the view's security mode differs from the local proposal file. | OpenAPI schema listing. | Low (anon denied on both tables) |
| R5 | Exposed RPCs. PostGIS `st_*` functions are callable but are pure computation. `postgis_version` confirmed harmless. Impact beyond that is not established. `rls_auto_enable` is not called (side effects possible); its EXECUTE grant is unknown. | Behaviour confirmed for 3 functions only. | Low; not treated as a vulnerability |
| R6 | Operational demo mode is disabled in production (`NODE_ENV=production` ignores demo headers). On Vercel, role-switch and write flows will return 401, so the live demo should be read-only. | `serverAuth.ts` line 31. | Demo-journey impact |

## 4. Option A vs Option B (not applied)

Repository search (`.from(`, `.insert/.update/.upsert/.delete`, `.rpc(`, `supabase.auth`, `CREATE FUNCTION/TRIGGER`, docs and tests):
- Writes happen only through the service role. Triggers: `handle_new_user` (SECURITY DEFINER, so it needs no authenticated INSERT on `profiles`). No client component writes. No sign-in UI exists, so no authenticated session is produced by the app itself.
- Cannot be confirmed from the repository: external clients, dashboard-created functions or triggers, pg_cron jobs, and Edge Functions.

**Recommendation: Option B** (authenticated `SELECT` only on `intervention_proposals`, `profiles`, `audit_events`), applied only after approval. It removes R2 and has no effect on current app behaviour. It does not address R1, which needs a code or auth-setting change.

## 5. Decision gate for the migration

Not ready. Open items: snapshot A–E from the owner; backup or PITR confirmation; choice of Option A or B; explicit approval of the exact SQL and checksum. Do not execute until all are met.

## 6. Snapshot queries A–E (owner to run in Supabase SQL Editor)

The exact queries are in `phase_6d_least_privilege_remediation_plan.md` section 5 (A: restore statements, B: column grants, C: object types/owners/view options/RLS flags, D: default ACLs, E: policies). Add these two read-only checks:
```sql
SELECT has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') AS anon_can_exec_rls_auto_enable;
SELECT pg_get_viewdef('public.v_published_historical_observations'::regclass, true);
```
No results have been invented.

## 7. Recommended pre-showcase actions (no database change)

1. Owner: in Supabase Dashboard → Authentication → disable new-user signups (nothing in the app needs them). Verify afterwards that `/auth/v1/settings` shows `disable_signup=true`.
2. Optional code fix, on request: trust `app_metadata.role` only and ignore `user_metadata`; add a regression test.
3. Keep the live demo read-only, or document that writes are intentionally disabled in production.

## 8. Stage 7 checklist: Vercel live showcase

The public URL is not in the repository (no `vercel.json`, no `.vercel/project.json`, no URL in the README), so I did not browse it. Owner to verify, without redeploying:
1. Vercel → Project → Settings → Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, Production); `JALDRISHTI_DEMO_MODE` is unset or not relied on in production.
2. The latest deployment status is Ready, built from the intended commit. The working tree has uncommitted changes, so confirm what is deployed.
3. Home, `/overview`, `/explorer`, `/risk-assessment`, `/monitoring`, `/data-sources`, `/interventions`, `/alerts`, `/admin`, `/privacy`, `/terms` all load without a console error or an error-boundary page.
4. State selector lists exactly: Karnataka, Telangana, Tamil Nadu, Madhya Pradesh, Rajasthan, Haryana, Punjab, Meghalaya, Assam, Tripura (no Uttar Pradesh, Sikkim or Arunachal Pradesh).
5. Map tiles and boundaries render; `GET /api/geospatial/blocks` returns `source: live_database`; `GET /api/historical-observations` returns data, not 503.
6. Charts render with labelled data-status badges; heuristic GSS notices and "simulated" alert labels are visible; no unsupported claims.
7. Mobile width (about 390 px): no horizontal overflow; navigation works.
8. Write actions show a clear unavailable or 401 message in production rather than a false success.

## 9. Files added this run
`scripts/check_public_exposure.cjs`, `scripts/check_anon_update_grant.cjs` and this report. The migration SQL was not modified.
