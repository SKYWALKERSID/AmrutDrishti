# Audit evidence index

- Repository: `main` at `a5bf142de146cdf3ab13765c9b499393f79759bd`.
- `npm test`: 152 passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `python -m pytest tests_py -q`: pytest missing.
- `node scripts/check_tables.js`: service role HTTP 401 for all queried tables.
- `node scripts/check_views.js`: anon historical view HTTP 200; service role HTTP 401.
- Security evidence: `src/app/api/interventions/route.ts`, `src/app/api/audit/route.ts`, `src/app/api/alerts/dispatch/route.ts`.
- Scientific evidence: `src/lib/services/scientificEngine.ts`, `src/lib/services/indicatorCalculationService.ts`.

Credentials and returned records were not printed.
