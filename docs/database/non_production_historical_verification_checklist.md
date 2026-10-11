# Non-production historical-observation verification checklist

This checklist is for a disposable/non-production Supabase environment. It does not authorize production changes.

## Database and security

- [ ] Confirm migration history matches the reviewed schema.
- [ ] Apply the reviewed nullable/provenance migration only in non-production.
- [ ] Confirm raw staging, stations, and observations retain RLS.
- [ ] Confirm anonymous access to raw observations is denied.
- [ ] Confirm the published view uses invoker security and approved fields only.
- [ ] Confirm the API role can read the published view but cannot write or read raw staging.

## Import preview and batch

- [ ] Verify snapshot URL, retrieval metadata, XLSX checksum, and row count.
- [ ] Verify LGD crosswalk checksum and six currently approved mappings.
- [ ] Confirm Niwari/Prithvipur never map to present-day Tikamgarh.
- [ ] Record accepted, rejected, quarantined, duplicate, null, coordinate, and date counts.
- [ ] Run the same preview twice and confirm deterministic output.
- [ ] Verify stable source-record idempotency on a repeated import.
- [ ] Test batch rollback and confirm row counts return to the pre-import state.

## API and UI

- [ ] Published rows return historical source, original date, unit, and quality metadata.
- [ ] Empty published results return an empty state, not fixtures.
- [ ] Query failures return an error state, not fixtures.
- [ ] Invalid filters return HTTP 400.
- [ ] Pagination and date filters are bounded.
- [ ] Null measurements display as missing, never zero.
- [ ] Historical observations are not labelled live/current.
- [ ] The opt-in panel remains disabled unless the feature flag is explicitly enabled.

## Release gate

- [ ] Data-owner reuse/attribution terms recorded.
- [ ] Database-owner approval recorded.
- [ ] Rollback evidence attached.
- [ ] Production authorization remains separate from this non-production test.
