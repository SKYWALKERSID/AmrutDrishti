-- PROPOSAL ONLY. Do not execute without database-owner and security approval.
-- The view assumes the reviewed lineage/publication columns exist.

begin;

create view public.v_published_historical_observations
with (security_invoker = true)
as
select
  s.station_id,
  s.station_name,
  s.district_id,
  d.name as district_name,
  s.block_id,
  b.name as block_name,
  o.observation_date,
  o.water_level_mbgl,
  'metre below ground level'::text as unit,
  o.quality_flag,
  ds.name as source_name,
  ds.provider as source_provider,
  l.source_resource_url,
  o.data_status,
  l.publication_status
from public.station_observations o
join public.monitoring_stations s on s.station_id = o.station_id
left join public.administrative_units b on b.unit_id = s.block_id
left join public.administrative_units d on d.unit_id = b.district_id
join public.station_observation_lineage l on l.observation_id = o.observation_id
join public.data_sources ds on ds.source_id = l.source_id
where o.data_status = 'observed'
  and l.validation_status = 'accepted'
  and l.publication_status = 'published';

-- Review required: grant access only to the approved server/API role.
-- Never grant anonymous access to raw observation tables.

rollback;
