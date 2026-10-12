# JalDrishti — Phase Fourteen: Security & Privacy Audit

**Document File:** `docs/audit/14_security_privacy_audit.md`

---

## 1. Security Architecture Review
- **Authentication & Identity:** Supabase Auth handles user sessions. Role mapping is established via `public.profiles` (`user_role_enum`: `district_collector`, `bdo`, `gram_pradhan`, `jal_samiti`, `environmental_analyst`, `admin`).
- **Authorization & Data Isolation:**
  - Row Level Security (RLS) enabled on all 14 database tables.
  - Jurisdiction scoping enforces that Block Development Officers (BDOs) and District Collectors can only view/mutate proposals within their designated district (`jurisdiction_district_id`).
- **Secrets Management:**
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are exposed for client-side PostgREST queries governed by RLS.
  - Secret service role keys are strictly absent from client bundles and git commits (enforced by [`.gitignore`](file:///D:/Projects/JalDrishti/.gitignore)).

---

## 2. Vulnerability Assessment Findings

| Vulnerability ID | Category | Severity | Description & Exploitability | Remediation |
| :--- | :--- | :---: | :--- | :--- |
| **SEC-01** | Authorization / Grants | **High** | Unapplied remote grants trigger 42501 error, preventing legitimate authenticated access to operational tables. | Apply `20261011000002_permissions_remediation.sql` to remote Supabase DB. |
| **SEC-02** | Rate Limiting | **Medium** | Public APIs (`/api/historical-observations`, `/api/geospatial/blocks`) lack explicit IP rate limiting headers. | Implement rate limiting middleware (e.g. Upstash Redis or Edge token bucket) before public deployment. |
| **SEC-03** | Injection Defense | **Low** | Parameterized queries via Supabase PostgREST prevent SQL injection. No dynamic SQL concatenation found. | Maintain current strict query binding patterns. |
| **SEC-04** | Data Privacy | **Low** | Well observations and rainfall records are public environmental data. Profile phone numbers are protected under RLS self-read policies. | Ensure profile data is never exposed via anonymous views. |
