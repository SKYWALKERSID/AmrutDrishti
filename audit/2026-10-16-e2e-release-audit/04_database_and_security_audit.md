# Database and security audit

## F-001 — Critical — privileged API paths lack request authorization

`src/app/api/interventions/route.ts:14-30,73-119` and `src/app/api/audit/route.ts:23-34,80-103` use `SUPABASE_SERVICE_ROLE_KEY` when present without authenticating the incoming caller or enforcing role/jurisdiction. `src/app/api/alerts/dispatch/route.ts:6-15` accepts arbitrary POST bodies and delegates to the live-capable SMS service. Impact: unauthorized reads/writes, forged audit events, intervention tampering and potential message abuse. Closure requires server-side identity, role/district checks, validation, rate limiting/CSRF protections as appropriate, and negative integration tests.

## F-005 — High — actual schema/RLS state is unverified

`supabase/migrations/20261011000002_permissions_remediation.sql:1-20` says it is unexecuted. Read-only service-role checks returned 401, so the deployed schema, grants and RLS policies cannot be established from migration text or fixture tests. No remote change was made.

## F-006 — Medium — placeholder clients conceal configuration faults

`src/lib/supabase/client.ts:7-13` and `src/lib/supabase/server.ts:7-8` create clients with placeholders. Operational routes should return explicit unavailable/configuration errors instead.
