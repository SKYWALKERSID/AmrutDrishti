# JalDrishti — Priority Remediation Plan & Future Roadmap

This document outlines prioritized next steps for transitioning JalDrishti from a verified prototype to a live operational platform.

---

## Priority Issue Backlog

### P0 — Critical (Must complete prior to production deployment)
1. **Server-Side Authentication & Session Authorization**:
   - *Current State:* Client-side role selector in React state.
   - *Action Plan:* Implement NextAuth.js / Auth0 with OAuth2 OIDC integration and server-side middleware route protection.
2. **Persistent Database Migration**:
   - *Current State:* Static fixtures in `app_src/lib/data/`.
   - *Action Plan:* Provision PostgreSQL + PostGIS database; run Prisma / Drizzle ORM migrations for spatial polygons and time-series tables.

### P1 — High (Core Decision Support & Production Telemetry)
3. **India-WRIS / CGWB Telemetry API Connector**:
   - *Current State:* Simulated station data fixtures.
   - *Action Plan:* Implement serverless API route handlers to fetch quarterly CGWB groundwater level data using MoJS API credentials.
4. **NIC / C-DAC SMS Gateway Integration**:
   - *Current State:* Simulated dispatch adapter.
   - *Action Plan:* Integrate CDAC DLT-approved SMS API endpoint with mandatory template registration for Hindi advisories.

### P2 — Medium (Enhancements & Verification)
5. **Cryptographic Append-Only Audit Logging**:
   - *Current State:* Client-side in-memory array.
   - *Action Plan:* Store audit events in an immutable PostgreSQL append-only audit table with SHA-256 event hash chaining.
6. **Empirical Model Calibration**:
   - *Current State:* Formula-based GSS with demonstration uncertainty ranges.
   - *Action Plan:* Conduct hydrogeological validation with CGWB regional ground-truth data in Bundelkhand.

---

## 5 Highest-Priority Immediate Next Actions
1. Deploy PostgreSQL/PostGIS database instance.
2. Configure OAuth2 authentication for District Collector & Hydrogeologist roles.
3. Register C-DAC DLT SMS template headers for Hindi advisory dispatches.
4. Establish automated pipeline for downloading NASA GRACE TWSA monthly netCDF files.
5. Conduct field validation with Bundelkhand ground-truth well networks.
