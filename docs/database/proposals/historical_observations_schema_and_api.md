# Historical observation schema and API proposal

This proposal is read-only design evidence. It is not a migration and has not been applied.

## Storage

- Make `station_observations.water_level_mbgl` nullable.
- Add a batch table keyed by source snapshot URL and SHA-256.
- Add an observation lineage table (or equivalent columns) containing source ID, source row key, raw timestamp, normalized date, unit, source quality flag, snapshot checksum, ingestion batch ID, validation status, and import timestamp.
- Use a stable source key such as `(source_id, source_record_key)` for idempotency. A new batch ID must not permit duplicate source observations.
- Keep staging and raw observations private with RLS. Do not grant `anon` access.
- Publish only validated rows through `v_published_historical_observations`.

## Publication view

The view must expose only approved display fields, require `publication_status = 'published'`, and retain `data_status = 'observed'`. It must not expose raw source rows, internal error details, or restricted station metadata.

## API contract

`GET /api/historical-observations` supports bounded `limit`/`offset` and validated district, block, station, and date-range filters. Successful data uses `source: historical_database`; an empty result returns HTTP 200 with an empty array; invalid filters return 400; authorization or database failures return 401/503. No fixture fallback is permitted.

## Approval gates

Before a migration or import: approve nullable handling, lineage fields, crosswalk, reuse terms, RLS policies, published fields, batch rollback, and named database owner authorization.
