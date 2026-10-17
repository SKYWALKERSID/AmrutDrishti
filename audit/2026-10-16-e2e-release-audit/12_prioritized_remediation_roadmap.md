# Prioritized remediation roadmap

1. **P0 contain API exposure:** enforce verified server identity and role/district authorization; prove unauthenticated and cross-jurisdiction denial.
2. **P0 repair trusted persistence:** owner validates intended project/secret; run approved read-only schema/RLS checks in non-production; do not auto-apply migrations.
3. **P0 eliminate misleading fallbacks:** prevent required persistence from returning success; retain simulation only in an explicit isolated demo mode.
4. **P1 scientific gate:** validate score/forecast against independent observations with uncertainty, calibration, and hydrogeology sign-off.
5. **P1 UI/a11y/performance gate:** real browsers at desktop/tablet/mobile; keyboard, screen reader, error and low-bandwidth paths.
6. **P2 operations:** DLT consent/delivery/rollback, monitoring, backups, incident response, CI/CD.
