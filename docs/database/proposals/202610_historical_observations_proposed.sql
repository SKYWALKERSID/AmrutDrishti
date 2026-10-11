-- PROPOSAL ONLY. Do not execute without database-owner approval.
-- Historical CGWB observation storage and publication design.

begin;

-- 1. Preserve nullable source measurements.
alter table public.station_observations
  alter column water_level_mbgl drop not null;

-- 2. Batch-level provenance and rollback boundary.
create table public.observation_ingestion_batches (
  batch_id uuid primary key default gen_random_uuid(),
  source_id text not null references public.data_sources(source_id),
  source_resource_url text not null,
  source_snapshot_sha256 text not null,
  source_row_count integer not null check (source_row_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  quarantined_count integer not null default 0 check (quarantined_count >= 0),
  status text not null check (status in ('preview','approved','loaded','rolled_back')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  operator_subject uuid,
  authorization_reference text
);

-- 3. Observation-level lineage and stable idempotency key.
create table public.station_observation_lineage (
  observation_id uuid primary key references public.station_observations(observation_id) on delete cascade,
  source_id text not null references public.data_sources(source_id),
  batch_id uuid not null references public.observation_ingestion_batches(batch_id),
  source_record_key text not null,
  source_row_number integer,
  raw_observation_timestamp text,
  normalized_observation_date date not null,
  original_unit text not null,
  source_quality_flag text,
  validation_status text not null check (validation_status in ('accepted','rejected','quarantined')),
  publication_status text not null default 'unpublished' check (publication_status in ('unpublished','published','withdrawn')),
  rejection_reason text,
  imported_at timestamptz not null default now(),
  unique (batch_id, source_record_key),
  unique (source_id, source_record_key)
);

rollback;
