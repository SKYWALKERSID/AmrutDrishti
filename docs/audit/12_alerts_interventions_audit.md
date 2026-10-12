# JalDrishti — Phase Twelve: Alerts & Interventions Audit

**Document File:** `docs/audit/12_alerts_interventions_audit.md`

---

## 1. Advisory & Alerting Lifecycle

1. **Trigger Condition:** Evaluates block risk severity (`severe` or `watch`) derived from composite indicators.
2. **Safe Wording Policy Compliance:**
   - Evaluated in [`src/app/alerts/page.tsx`](file:///D:/Projects/JalDrishti/src/app/alerts/page.tsx) and [`tests/stage5ClaimsAndSafety.test.ts`](file:///D:/Projects/JalDrishti/tests/stage5ClaimsAndSafety.test.ts).
   - Prohibits panic phrasing, sensationalized countdowns ("days until wells run dry"), or emergency declarations.
   - Restricts copy to empirical, seasonal crop-water advisories (e.g., micro-irrigation encouragement, mulching, check-dam desiltation).
3. **Dispatch Mechanism:**
   - Operates in **SIMULATED MODE**.
   - Generates simulated dispatch logs with badges: `[SIMULATED DISPATCH]`.
   - Zero live external SMS gateways (e.g., CDAC, Twilio) or WhatsApp Business APIs are connected, preventing accidental message transmissions.

---

## 2. Interventions & Government Schemes Catalog
- **Supported Programs:** PMKSY (Per Drop More Crop), MGNREGA water conservation works, Atal Bhujal Yojana, and Mission Amrit Sarovar.
- **Workflow State:**
  - Proposals submitted via `/interventions` populate client-side React state.
  - Future remediation must persist these records into PostgreSQL `intervention_proposals` table with District Collector / BDO role verification.
