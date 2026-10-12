# JalDrishti — Phase Three: Frontend, User Experience & Data Wiring Audit

**Document File:** `docs/audit/03_frontend_and_data_wiring.md`

---

## 1. Traceability of Displayed Metrics
Every metric presented in the user interface was traced backward through the UI component, state hooks, API endpoints, and data layers:

1. **Dashboard KPI Widgets (`/`)**
   - **Path:** [`src/app/page.tsx`](file:///D:/Projects/JalDrishti/src/app/page.tsx) → reads `ALL_BLOCKS` from [`src/lib/data/bundelkhand.ts`](file:///D:/Projects/JalDrishti/src/lib/data/bundelkhand.ts).
   - **Status:** Uses cohesive static demonstration fixtures representing Bundelkhand pilot blocks.
   - **Finding:** Fully functional client filtering, but does not yet consume `/api/geospatial/blocks` on page load.
2. **Map Explorer Popups & Markers (`/explorer`)**
   - **Path:** [`src/components/MapExplorer.tsx`](file:///D:/Projects/JalDrishti/src/components/MapExplorer.tsx) → `fetch('/api/geospatial/blocks')` → [`src/lib/services/geospatialService.ts`](file:///D:/Projects/JalDrishti/src/lib/services/geospatialService.ts) → Supabase PostgREST client.
   - **Status:** Features graceful error catching. If Supabase returns 42501 (insufficient privilege), it sets `source = 'demonstration_fixture'` and renders `ALL_BLOCKS` with an explicit amber disclaimer badge.
   - **Finding:** Excellent resilient wiring; user never faces an unhandled application crash.
3. **Multi-Indicator Monitoring Charts (`/monitoring`)**
   - **Path:** [`src/app/monitoring/page.tsx`](file:///D:/Projects/JalDrishti/src/app/monitoring/page.tsx) → Recharts plotting `cgwbWellDepthMbgl`, `graceTwsaCm`, and `rainfallAnomalyMm`.
   - **Status:** Renders static multi-year trends; accompanied by [`HistoricalObservationsPanel.tsx`](file:///D:/Projects/JalDrishti/src/components/HistoricalObservationsPanel.tsx) which queries `/api/historical-observations`.
   - **Finding:** Panel displays clean "Historical Observations Unavailable (Code 503)" empty state when remote database view is unmigrated, ensuring transparency.

---

## 2. Master Vibe-Coding Design Compliance
The application was evaluated against the 30 prohibited design patterns:
- **Harsh Gradients / Neon / Rainbow Colors:** None detected. Background uses warm off-white `#f8f7f4`.
- **Pure White Canvas:** None detected. Surface cards use `#ffffff` with subtle `#e2ded4` borders over `#f8f7f4` body.
- **Radial Orbs / Liquid Glass / Bento Grids:** None. Layout uses clean, accessible grid systems and cards.
- **Third-Party Generic Icons:** None. Uses custom inline SVG icons ([`src/components/ui/Icons.tsx`](file:///D:/Projects/JalDrishti/src/components/ui/Icons.tsx)).
- **Fake Testimonials / Fabricated Claims:** None. All data notices clearly explain demonstration status.

---

## 3. Bilingual Experience & Localization
- **Language Context:** Managed by [`src/lib/context/LanguageContext.tsx`](file:///D:/Projects/JalDrishti/src/lib/context/LanguageContext.tsx).
- **Coverage:** Global header, sub-navigation, card statistics, table headers, risk severity badges, and Hindi alert templates respond immediately to the toggle switch without requiring page reload.
