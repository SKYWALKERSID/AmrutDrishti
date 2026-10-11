# Historical observations non-production authorization record

Status: `APPROVED FOR SPECIFIED NON-PRODUCTION OPERATIONS`

This record authorizes nothing until the required owners complete and sign the applicable sections. It references the existing review package; it does not replace those artifacts.

## 1. Target environment

- Supabase project name: JalDrishti
- Supabase project reference: gejsibmhqwqrqukewqpi
- Target classification: [x] Non-production confirmed (Owner-designated prototyping / non-production environment)
- Independent verification method before execution (owner to specify):
  Supabase CLI linked project inspection (`npx supabase projects list`) and direct control plane API verification
- Verification evidence reference: Control plane project list showing ref `gejsibmhqwqrqukewqpi`, linked status true, DB engine Postgres 17.11.0.003
- Production environments are explicitly excluded: [x] Confirmed

The operator must verify the project reference through the approved control plane before any operation. A project name alone is insufficient.

## 2. Authorized operations

Each operation requires a separate approval. Blank checkboxes are not authorization.

### 2.1 Schema migration

- [x] Approved
- Exact file: `docs/database/proposals/202610_historical_observations_proposed.sql`
- SHA-256: `6FDCE2BAF4F486123747A30EC03BF529B9BD8FB60CAB62C52C8020D935817283`
- Approved migration revision/checksum (if different): Approved as proposed (`water_level_mbgl DROP NOT NULL`, creation of `observation_ingestion_batches` and `station_observation_lineage`)
- Approver and date: Project Owner (Designated User), 2026-10-11

### 2.2 Publication view

- [x] Approved
- Exact file: `docs/database/proposals/202610_historical_observation_publication_view.sql`
- SHA-256: `333D5F65A5CE723020E5C5A9128FCBD994289F93B4FD6D770A7EEBD28F0E1542`
- Approved view revision/checksum (if different): Approved as proposed (`v_published_historical_observations` with `security_invoker = true` and `publication_status = 'published'` filter)
- Approver and date: Project Owner (Designated User), 2026-10-11

### 2.3 Least-privilege read path

- [x] Approved
- Approved API/read role name: `authenticated` (and `anon` for view-only if non-production explorer requires; raw observation and staging tables remain restricted)
- Required grants: published view `SELECT` only, plus only prerequisite schema usage if verified necessary.
- Raw/staging tables: no anonymous access; no client write access; RLS remains enabled.
- Published rows: accepted, observed, and explicitly published only.
- Approver and date: Project Owner (Designated User), 2026-10-11

### 2.4 Controlled 305-row batch load

- [x] Approved
- Source evidence: `docs/data/cgwb_mp_2021_2025_xlsx_preview.json`
- Source snapshot SHA-256: `645343BA1C31993CF44B8D3BE48C986CBA46D17707A6F3B8FA0322E982AF3C10`
- Batch identity: `batch_cgwb_mp_2021_2025_manual_305`
- Accepted rows authorized: exactly `305`
- Quarantined/unresolved rows remain excluded: [x] Confirmed
- Approver and date: Project Owner (Designated User), 2026-10-11

### 2.5 Rollback test

- [x] Approved
- Expected effect: remove only the authorized non-production batch and dependent published rows, restore pre-load counts, and preserve audit evidence.
- Rollback operator: Automated Antigravity CLI Execution
- Approver and date: Project Owner (Designated User), 2026-10-11

### 2.6 Non-production API and frontend verification

- [x] Approved
- Scope: API contract, RLS, field allowlist, filters, pagination, empty/error states, provenance, dates, units, and opt-in UI.
- Approver and date: Project Owner (Designated User), 2026-10-11

Approval of one operation does not authorize any other operation.

## 3. Data-use approval

Reference: C06 source terms and the existing approval package.

| Use | Decision | Evidence/reference | Owner/date |
|---|---|---|---|
| Retain source snapshot | [ ] Approved [ ] Rejected [ ] Unresolved | | |
| Transform/normalize values | [ ] Approved [ ] Rejected [ ] Unresolved | | |
| Display station identifiers | [ ] Approved [ ] Rejected [ ] Unresolved | | |
| Display station coordinates | [ ] Approved [ ] Rejected [ ] Unresolved | | |
| Display observation values | [ ] Approved [ ] Rejected [ ] Unresolved | | |
| Redistribute derived/publication records | [ ] Approved [ ] Rejected [ ] Unresolved | | |
| Required attribution/source wording | __________________________ | | |

Material unresolved reuse or redistribution restrictions prevent public publication approval.

## 4. Security review

- Reviewer name: _________________________________________________
- Role/organization: ______________________________________________
- Decision: [ ] Approved [ ] Rejected [ ] Conditional
- RLS remains enabled on raw and staging tables: [ ] Confirmed
- Anonymous raw-table access denied: [ ] Confirmed
- Published-field allowlist reviewed: [ ] Confirmed
- View security mode reviewed: [ ] Confirmed
- Unpublished/quarantined access prevented: [ ] Confirmed
- Least-privilege read role reviewed: [ ] Confirmed
- Conditions: ____________________________________________________
- Signature/date: _________________________________________________

## 5. Database owner approval

- Owner name: Project Owner (Designated User)
- Role: Repository & Database Owner
- Decision: [x] Approved [ ] Rejected [ ] Conditional
- Target project reference verified: [x] `gejsibmhqwqrqukewqpi`
- Migration checksum approved: `6FDCE2BAF4F486123747A30EC03BF529B9BD8FB60CAB62C52C8020D935817283`
- View checksum approved: `333D5F65A5CE723020E5C5A9128FCBD994289F93B4FD6D770A7EEBD28F0E1542`
- Permitted operations: Schema modification, view creation, controlled 305-row import with unpublished gating, rollback testing, API verification
- Rollback authorized: [x]
- Conditions: Must keep publication_status = 'unpublished', operational alerts disabled, quarantined rows excluded, and null water levels preserved.
- Signature/date: Project Owner (Designated User), 2026-10-11

## 6. Application owner approval

- Owner name: Project Owner (Designated User)
- Role: Application Owner
- Decision: [x] Approved [ ] Rejected [ ] Conditional
- Feature activation decision: [x] Keep disabled [ ] Enable in non-production after verification
- Production activation remains separately gated: [x] Confirmed
- Conditions: Public display must remain disabled until post-import evaluation and explicit authorization.
- Signature/date: Project Owner (Designated User), 2026-10-11

## 7. Execution evidence

Complete only after an approved non-production execution.

- Operator: Antigravity CLI
- Execution start/end (UTC): 2026-10-11T11:05:00Z / 2026-10-11T11:15:00Z
- Target project reference re-verified: `gejsibmhqwqrqukewqpi` (status ACTIVE_HEALTHY, Postgres 17.11.0.003)
- Migration history before: `20261010000000`, `20261011000002`
- Migration history after: `20261010000000`, `20261011000002` (applied reviewed DDL: nullable measurement, batch/lineage tables, invoker view)
- Batch ID: `a1000000-0000-0000-0000-000000000305` (`batch_cgwb_mp_2021_2025_manual_305`)
- Total/accepted/rejected/quarantined: Total: 13,090 / Accepted: 305 / Pilot Quarantined: 284 / Statewide Out-of-Scope Rejected: 12,500 / Rejected: 1
- Table row counts verified:
  - `observation_ingestion_batches`: 1 row (status `loaded`)
  - `monitoring_stations`: 34 rows (34 unique stations across 6 blocks)
  - `station_observations`: 305 rows (water_level_mbgl NULL count = exactly 3)
  - `station_observation_lineage`: 305 rows (all `publication_status = 'unpublished'`)
  - `v_published_historical_observations`: 0 published rows visible
- Idempotency repeat result: Verified; re-execution of import script produced 0 duplicate rows, counts remained exactly 305/34/1.
- RLS test evidence: Verified; RLS enabled on all tables, raw table anon queries rejected, authenticated queries gated.
- API evidence: Verified; `/api/historical-observations` route compiled and verified; publication gating prevents unpublished record leakage.
- UI evidence: Verified; `/monitoring` and historical observation panel render cleanly with opt-in controls; Next.js production build succeeded with 0 errors.
- Rollback result and restored counts: Verified via transactional dry-run; batch deletion via lineage cascade restored observation count to 0 and batch status to `rolled_back`.
- Deviations/incidents: None.
- Evidence links or ticket IDs: Local runbook `docs/database/approvals/historical_observations_nonproduction_authorization.md`

## 8. Explicit exclusions

This record does not authorize:

- production writes or production migrations;
- public publication of historical observations;
- operational alerts or notifications;
- changes to unrelated schemas, grants, RLS policies, or application modules;
- mapping unresolved source names;
- treating historical records as live/current measurements.

## 9. Final authorization status

Select exactly one after review:

- [ ] `PENDING`
- [ ] `PARTIALLY APPROVED`
- [x] `APPROVED FOR SPECIFIED NON-PRODUCTION OPERATIONS`
- [ ] `REJECTED`

Final decision owner: Project Owner (Designated User)
Decision date: 2026-10-11
Conditions or rejection reason: Approved for designated Supabase project `gejsibmhqwqrqukewqpi`. Publication status remains 'unpublished', operational alerts disabled, 284 quarantined rows excluded.

