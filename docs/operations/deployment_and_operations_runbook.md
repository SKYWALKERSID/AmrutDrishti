# JalDrishti Platform — Deployment and Operations Runbook

**Document ID**: `JD-OPS-048`  
**Version**: `v1.0`  
**Governed by**: TRD §8, PRD §5, and Master Checklist `JD-048`

---

## 1. System Overview & Architecture
JalDrishti is an India-focused groundwater intelligence and decision-support platform (Next.js App Router + PostgreSQL/Supabase with PostGIS) designed to address groundwater scarcity across India, with initial geographic priorities in Madhya Pradesh, Punjab, Rajasthan, Haryana, Uttar Pradesh, Assam, Meghalaya, and Arunachal Pradesh.

- **Frontend & Server Components**: Next.js 15 (Node.js runtime)
- **Spatial Database**: PostgreSQL 15 + PostGIS (`public.administrative_units` with SOI 2025 boundary polygons)
- **Security & Authorization**: Row Level Security (RLS) + pure testable RBAC engine (`governanceService.ts`)
- **Audit System**: Append-only PostgreSQL logging (`public.audit_events`)

---

## 2. Environment Configuration

### Required Production Variables (`.env.local` / Secret Manager)
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_<anon_key>
SUPABASE_SERVICE_ROLE_KEY=sb_secret_<service_role_key>

# Government DLT SMS Gateway (TRAI Regulations)
DLT_SMS_API_KEY=<cdac_or_nic_api_key>
DLT_ENTITY_ID=<trai_registered_entity_id>
DLT_SENDER_ID=JALDRS
DLT_GATEWAY_URL=https://api.sms.gov.in/send
```

> [!IMPORTANT]
> Never commit `.env` or `.env.local` to Git. The `.gitignore` file enforces exclusion.

---

## 3. Database Privileges & Idempotent Migrations
All migrations reside in `supabase/migrations/`:
1. `20261010000000_init_schema.sql`: Core schema, 14 tables, spatial geometries, indexes, and RLS policies.
2. `20261010000001_grant_public_read_permissions.sql`: Least-privilege public reference read access.
3. `20261011000002_permissions_remediation.sql`: Strict district scoping and authenticated access controls.
4. `scripts/grant_all_service_role.sql`: Standard service role backend access for background workers and crons.

---

## 4. Routine Operations & Maintenance

### 1. Quarterly Ingestion Cron
To ingest new quarterly updates from IMD / CGWB:
```bash
npx tsx scripts/cron_imd_pull.ts
```
- Performs geodetic bounding check ($20^\circ-30^\circ\text{ N}, 75^\circ-85^\circ\text{ E}$)
- Validates physical rainfall bounds ($[0, 500]\text{ mm}$)
- Records ingestion summary and telemetry to `public.ingestion_runs`

### 2. Seeding Government Schemes Catalogue
To update or refresh the 4 Central and State schemes (Atal Bhujal Yojana, JJM, MGNREGA, Mission Amrit Sarovar):
```bash
npx tsx scripts/seed_schemes.ts
```

### 3. Emergency Advisory Kill Switch
If an unexpected telemetry spike occurs, the advisory kill switch freezes all alert dispatches instantly:
```typescript
import { setGlobalAlertKillSwitch } from '@/lib/services/governanceService';
setGlobalAlertKillSwitch(true);
```

---

## 5. Verification & Health Check Commands
Before any deployment or release tagging:
```bash
# 1. Execute full unit & contract test suite
npm test

# 2. Compile full production Next.js build
npm run build
```
Acceptance criteria:
- `npm test` must output 0 failures across all 134 tests.
- `npm run build` must compile clean static pages (11/11 routes).
