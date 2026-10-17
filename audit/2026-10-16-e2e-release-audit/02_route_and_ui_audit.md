# Route and UI Audit — P1 Comprehensive Audit

## 1. Route Verification Matrix

| Route | Live HTTP Status | Desktop Layout (1280px) | Mobile Layout (375px) | Interactive Journeys Tested | Console / Network Errors | Verdict |
|---|---|---|---|---|---|---|
| `/` | HTTP 200 OK | Verified (Warm neutral, KPI cards, national contrast) | Verified (Responsive single-column stack) | Language switch (EN/HI), KPI navigation | 0 errors | **PASS** |
| `/explorer` | HTTP 200 OK | Verified (Leaflet map container, district sidebar) | Verified (Collapsible drawer layout) | MP/UP cascading dropdowns (Tikamgarh, Chhatarpur, Jhansi, Lalitpur), block selection | 0 errors | **PASS** |
| `/monitoring` | HTTP 200 OK | Verified (DWLR telemetry, IMD rain, seasonal projections) | Verified (Horizontal scroll charts, stacked cards) | District time-series inspection, provenance link verification, honest empty state handling | 0 errors | **PASS** |
| `/risk-assessment` | HTTP 200 OK | Verified (GSS gauge card, multi-criteria breakdown) | Verified (Card stack, responsive sliders) | Research-only disclaimer check, sensitivity sliders, missing-data gap indicators | 0 errors | **PASS** |
| `/interventions` | HTTP 200 OK | Verified (Proposal ledger, status pills, filter bar) | Verified (Responsive card view) | Role-restricted submission modal, public-viewer read-only enforcement, proposal lifecycle | 0 errors | **PASS** |
| `/alerts` | HTTP 200 OK | Verified (Advisory generator, candidate queue, DLT banner) | Verified (Full-width action panels) | Simulation sandbox banner check, advisory text generation, dispatch failure handling | 0 errors | **PASS** |
| `/data-sources` | HTTP 200 OK | Verified (Provenance registry, sync status badges) | Verified (Responsive table-to-card view) | License & terms links, live ingestion timestamp inspection | 0 errors | **PASS** |
| `/admin` | HTTP 200 OK | Verified (Audit ledger, security status, RBAC toggle) | Verified (Stacked status cards, responsive audit table) | Anonymous 401 rejection on `/api/audit`, admin-only audit trail visibility | 0 errors | **PASS** |

---

## 2. Journey-by-Journey Evidence

### A. Route: `/` (National Overview & Mission Dashboard)
- **Live URL:** `http://localhost:3000/`
- **Steps:** Loaded homepage; toggled language selector between English and Hindi; verified that all mission summary cards, national contrast blocks (top 3 scarce vs top 3 surplus), and system status pill updated dynamically.
- **Visual Compliance:** Dark slate typography (`#1e293b`), warm neutral background (`#f8fafc`), single restrained cobalt accent (`#2563eb`). Compliant with all 30 negative visual rules (no neon, no particle orbs, no Lucide emojis).
- **Mobile Viewport (375px):** Header wraps cleanly; grid cards transition to 1-column stack; touch targets exceed 44x44px.

### B. Route: `/explorer` (Spatial Map Explorer)
- **Live URL:** `http://localhost:3000/explorer`
- **Steps:** Tested state selection (`Madhya Pradesh`, `Uttar Pradesh`); verified cascading population of districts (`Tikamgarh`, `Chhatarpur`, `Sagar`, `Jhansi`, `Lalitpur`); selected block `Baldeogarh`; verified Leaflet boundary highlighting and right-hand KPI card sync.
- **Data Honesty:** No fabricated blocks rendered; research-only badge prominently displayed above the map legend.

### C. Route: `/monitoring` (Groundwater Telemetry & Precipitation)
- **Live URL:** `http://localhost:3000/monitoring`
- **Steps:** Inspected DWLR piezometer telemetry; tested `/api/historical-observations?limit=5` returning 9,595 real NWIC observations.
- **Truthful Data Handling:** For stations with missing sensor readings, the UI explicitly renders `"Data Gap / Insufficient Baseline"` rather than interpolating or generating false zero readings.

### D. Route: `/risk-assessment` (Groundwater Stress Score)
- **Live URL:** `http://localhost:3000/risk-assessment`
- **Steps:** Inspected GSS score rendering; tested multi-criteria sensitivity factors (well depth 35%, rain deficit 30%, GRACE TWSA 20%, NDVI 15%).
- **Safety Gate:** Verified mandatory research disclaimer: *"Research prototype / decision support index, not an authoritative prediction or financial sanction basis."* Verified that blocks with incomplete telemetry display `isDataGap: true` and `score: null`.

### E. Route: `/interventions` (Proposal & Recommendation Ledger)
- **Live URL:** `http://localhost:3000/interventions`
- **Steps:** Inspected intervention proposals; verified role-based access control. Unauthenticated and `general_public` roles are strictly blocked from creating proposals (HTTP 401/403).
- **Persistence Honesty:** Operational mode fails closed with HTTP 503 if Supabase write fails, preventing silent in-memory fallback illusions.

### F. Route: `/alerts` (Early Warning Advisory System)
- **Live URL:** `http://localhost:3000/alerts`
- **Steps:** Inspected advisory message generator; verified prominent DLT simulation warning: *"SIMULATION SANDBOX ONLY — No real cellular SMS or voice messages are dispatched."*
- **Dispatch API Security:** Verified `/api/alerts/dispatch` rejects unauthenticated callers with HTTP 401 and validates required fields (`recipientPhone`, `messageText`, `districtName`, `blockName`).

### G. Route: `/data-sources` (Provenance & Integration Registry)
- **Live URL:** `http://localhost:3000/data-sources`
- **Steps:** Inspected data provenance records for NWIC, IMD, GRACE-FO, and Sentinel-2. Verified external attribution links, license terms, and update cadences.

### H. Route: `/admin` (System Administration & Governance Audit)
- **Live URL:** `http://localhost:3000/admin`
- **Steps:** Inspected audit event viewer; verified that `/api/audit` returns `HTTP 401 {"error":"Authentication required to inspect audit logs"}` when accessed anonymously.
