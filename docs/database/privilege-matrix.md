# JAL DRISHTI — Privilege Matrix & Access Control Model

**Date:** 2026-10-11  
**Baseline Schema:** `20261010000000_init_schema.sql`  
**Prior Grant Migration:** `20261010000001_grant_public_read_permissions.sql` (superseded)  
**Remediation Target:** `20261011000002_permissions_remediation.sql`

---

## 1. Schema Tables Overview (14 Tables)

All tables reside in the `public` schema. All 14 tables have PostgreSQL Row Level Security (RLS) enabled.

---

## 2. SQL Privilege Boundary Matrix

| Table | `anon` SELECT | `authenticated` SELECT | `authenticated` INSERT | `authenticated` UPDATE | `authenticated` DELETE | Purpose & Security Scope |
|---|:---:|:---:|:---:|:---:|:---:|---|
| `administrative_units` | ✅ | ✅ | ❌ | ❌ | ❌ | Public boundary reference data (State, District, Block centroids/polygons). |
| `derived_indicators` | ✅ | ✅ | ❌ | ❌ | ❌ | Aggregated indicators for public dashboards. RLS/publication lifecycle controls status. |
| `data_sources` | ✅ | ✅ | ❌ | ❌ | ❌ | Public data provenance & source registry (IMD, CGWB, GRACE metadata). |
| `schemes` | ✅ | ✅ | ❌ | ❌ | ❌ | Public government scheme catalogue (MGNREGA, PMKSY, Jal Jeevan Mission). |
| `monitoring_stations` | ❌ | ✅ | ❌ | ❌ | ❌ | CGWB & state telemetry station locations & depths. Authenticated users only. |
| `station_observations` | ❌ | ✅ | ❌ | ❌ | ❌ | Time-series well water level measurements. Authenticated users only. |
| `model_predictions` | ❌ | ✅ | ❌ | ❌ | ❌ | ML forward stress predictions & uncertainty bounds. Authenticated users only. |
| `model_registry` | ❌ | ✅ | ❌ | ❌ | ❌ | ML architecture versions and training metrics. Authenticated users only. |
| `intervention_recommendations` | ❌ | ✅ | ❌ | ❌ | ❌ | Automated scheme recommendations. Authenticated users only. |
| `intervention_proposals` | ❌ | ✅ | ✅ | ✅ | ❌ | Operational proposals with budgets and workflows. Jurisdiction-scoped via RLS. |
| `profiles` | ❌ | ✅ | ❌ | ✅ | ❌ | User directory with assigned roles & districts. Self + district scoped; role lock. |
| `notification_records` | ❌ | ✅ | ❌ | ❌ | ❌ | Advisory notifications. Scoped to recipient phone or district officer. PII protected. |
| `ingestion_runs` | ❌ | ✅ | ❌ | ❌ | ❌ | Pipeline health and telemetry logs. Admin and Environmental Analyst only via RLS. |
| `audit_events` | ❌ | ✅ | ✅ | ❌ | ❌ | Security audit trail. Append-only (INSERT allowed, strictly NO UPDATE or DELETE). |

### Schema Usage Grants
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
```

---

## 3. RLS Policies Comparison: Initial vs Remediated

| Table | Operation | Initial Policy (Migration 000000) | Remediated Policy (Migration 000002) | Enforced Security Property |
|---|:---:|---|---|---|
| `administrative_units` | SELECT | `USING (true)` | Preserved (`USING (true)`) | Public access for base map layers |
| `data_sources` | SELECT | `USING (true)` | Preserved (`USING (true)`) | Public provenance transparency |
| `schemes` | SELECT | `USING (true)` | Preserved (`USING (true)`) | Public scheme catalogue |
| `derived_indicators` | SELECT | `USING (true)` | Preserved base policy | Public read enabled; publication status gated via C04 view |
| `monitoring_stations` | SELECT | `USING (true)` (Overly Permissive) | Authenticated-only (`TO authenticated USING (true)`) | Denies anonymous scraping of monitoring stations |
| `station_observations` | SELECT | `USING (true)` (Overly Permissive) | Authenticated-only (`TO authenticated USING (true)`) | Denies anonymous scraping of raw observation points |
| `model_predictions` | SELECT | `USING (true)` (Overly Permissive) | Authenticated-only (`TO authenticated USING (true)`) | Denies anonymous access to experimental forecasts |
| `intervention_recommendations` | SELECT | `USING (true)` (Overly Permissive) | Authenticated-only (`TO authenticated USING (true)`) | Denies anonymous access to internal recommendations |
| `intervention_proposals` | SELECT | `USING (true)` (Overly Permissive) | District-scoped (`admin` or `district_name = current_user_district()`) | Prevents cross-district data leakage and anonymous harvesting |
| `intervention_proposals` | INSERT | Role check only (Missing jurisdiction check) | Role check + District match + Block FK integrity in district | Prevents submitting proposals for other districts or invalid blocks |
| `intervention_proposals` | UPDATE | DC unconstrained across all districts | DC & BDO scoped strictly to own district; Admin global | Prevents cross-district sanctioning or mutation |
| `model_registry` | SELECT | None (RLS blocked all rows) | Authenticated-only (`TO authenticated USING (true)`) | Enables authenticated officers/analysts to view model info |
| `profiles` | SELECT | District + Self scoped | Preserved from 000000 | District officer directory visibility |
| `profiles` | UPDATE | Self-update with role immutability | Preserved from 000000 | Non-admins cannot alter their own role or jurisdiction |
| `notification_records` | SELECT | Recipient phone or district officer | Preserved from 000000 | PII masking; prevents unauthorized message intercept |
| `ingestion_runs` | SELECT | Admin or Environmental Analyst only | Preserved from 000000 | Prevents public pipeline telemetry probing |
| `audit_events` | INSERT | `actor_id = auth.uid()` | Preserved from 000000 | Ensures authentic audit attribution |
| `audit_events` | SELECT | Admin, DC, or Self | Preserved from 000000 | Restricts raw audit access to compliance officers |

---

## 4. Helper Function Security Audit

| Function | Type | Language | Defined Options | Security Posture |
|---|---|---|---|---|
| `public.current_user_role()` | `SECURITY DEFINER` | SQL | `STABLE SET search_path = pg_catalog, public` | ✅ Safe. Immutable search path avoids malicious schema hijacking. |
| `public.current_user_district()` | `SECURITY DEFINER` | SQL | `STABLE SET search_path = pg_catalog, public` | ✅ Safe. Immutable search path avoids malicious schema hijacking. |
| `public.handle_new_user()` | `SECURITY DEFINER` | PLPGSQL | `SET search_path = pg_catalog, public` | ✅ Safe. Inserts default profile with role `bdo` on auth trigger. |

---

## 5. Summary of Security Safeguards

1. **Zero DELETE Grants**: No role (neither `anon` nor `authenticated`) receives `DELETE` privileges on any table in the schema.
2. **No `GRANT ALL`**: Every SQL privilege is enumerated individually.
3. **Atomic Remediation**: All policy removals, grants, and additions are enclosed within a PostgreSQL transaction block (`BEGIN ... COMMIT;`).
4. **Append-Only Audit Log**: `audit_events` has only `INSERT` and `SELECT` grants; no `UPDATE` or `DELETE` grants exist anywhere.
5. **Role & Jurisdiction Immutability**: Profiles cannot be modified by non-admin users to elevate role or alter jurisdiction.
