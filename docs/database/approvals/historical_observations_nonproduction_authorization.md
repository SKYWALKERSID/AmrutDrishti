# Historical observations non-production authorization record

Status: `PENDING`

This record authorizes nothing until the required owners complete and sign the applicable sections. It references the existing review package; it does not replace those artifacts.

## 1. Target environment

- Supabase project name: __________________________________________
- Supabase project reference: ______________________________________
- Target classification: [ ] Non-production confirmed
- Independent verification method before execution (owner to specify):
  _________________________________________________________________
- Verification evidence reference: _________________________________
- Production environments are explicitly excluded: [ ] Confirmed

The operator must verify the project reference through the approved control plane before any operation. A project name alone is insufficient.

## 2. Authorized operations

Each operation requires a separate approval. Blank checkboxes are not authorization.

### 2.1 Schema migration

- [ ] Approved
- Exact file: `docs/database/proposals/202610_historical_observations_proposed.sql`
- SHA-256: `6FDCE2BAF4F486123747A30EC03BF529B9BD8FB60CAB62C52C8020D935817283`
- Approved migration revision/checksum (if different): __________________
- Approver and date: _______________________________________________

### 2.2 Publication view

- [ ] Approved
- Exact file: `docs/database/proposals/202610_historical_observation_publication_view.sql`
- SHA-256: `333D5F65A5CE723020E5C5A9128FCBD994289F93B4FD6D770A7EEBD28F0E1542`
- Approved view revision/checksum (if different): ____________________
- Approver and date: _______________________________________________

### 2.3 Least-privilege read path

- [ ] Approved
- Approved API/read role name: ______________________________________
- Required grants: published view `SELECT` only, plus only prerequisite schema usage if verified necessary.
- Raw/staging tables: no anonymous access; no client write access; RLS remains enabled.
- Published rows: accepted, observed, and explicitly published only.
- Approver and date: _______________________________________________

### 2.4 Controlled 305-row batch load

- [ ] Approved
- Source evidence: `docs/data/cgwb_mp_2021_2025_xlsx_preview.json`
- Source snapshot SHA-256: `645343BA1C31993CF44B8D3BE48C986CBA46D17707A6F3B8FA0322E982AF3C10`
- Batch identity: _________________________________________________
- Accepted rows authorized: exactly `305`
- Quarantined/unresolved rows remain excluded: [ ] Confirmed
- Approver and date: _______________________________________________

### 2.5 Rollback test

- [ ] Approved
- Expected effect: remove only the authorized non-production batch and dependent published rows, restore pre-load counts, and preserve audit evidence.
- Rollback operator: ______________________________________________
- Approver and date: _______________________________________________

### 2.6 Non-production API and frontend verification

- [ ] Approved
- Scope: API contract, RLS, field allowlist, filters, pagination, empty/error states, provenance, dates, units, and opt-in UI.
- Approver and date: _______________________________________________

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

- Owner name: ____________________________________________________
- Role: __________________________________________________________
- Decision: [ ] Approved [ ] Rejected [ ] Conditional
- Target project reference verified: [ ]
- Migration checksum approved: _____________________________________
- View checksum approved: _________________________________________
- Permitted operations: ____________________________________________
- Rollback authorized: [ ]
- Conditions: ____________________________________________________
- Signature/date: _________________________________________________

## 6. Application owner approval

- Owner name: ____________________________________________________
- Role: __________________________________________________________
- Decision: [ ] Approved [ ] Rejected [ ] Conditional
- Feature activation decision: [ ] Keep disabled [ ] Enable in non-production after verification
- Production activation remains separately gated: [ ] Confirmed
- Conditions: ____________________________________________________
- Signature/date: _________________________________________________

## 7. Execution evidence

Complete only after an approved non-production execution.

- Operator: ______________________________________________________
- Execution start/end (UTC): ______________________________________
- Target project reference re-verified: _____________________________
- Migration history before: ________________________________________
- Migration history after: _________________________________________
- Batch ID: _______________________________________________________
- Total/accepted/rejected/quarantined: ______________________________
- Idempotency repeat result: _______________________________________
- RLS test evidence: _______________________________________________
- API evidence: __________________________________________________
- UI evidence: ___________________________________________________
- Rollback result and restored counts: ______________________________
- Deviations/incidents: ____________________________________________
- Evidence links or ticket IDs: ____________________________________

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

- [x] `PENDING`
- [ ] `PARTIALLY APPROVED`
- [ ] `APPROVED FOR SPECIFIED NON-PRODUCTION OPERATIONS`
- [ ] `REJECTED`

Final decision owner: ______________________________________________
Decision date: ____________________________________________________
Conditions or rejection reason: ____________________________________
