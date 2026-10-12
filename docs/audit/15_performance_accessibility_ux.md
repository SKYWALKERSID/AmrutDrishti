# JalDrishti — Phase Fifteen: Performance, Accessibility & UX Audit

**Document File:** `docs/audit/15_performance_accessibility_ux.md`

---

## 1. Frontend Performance & Bundle Metrics
- **Next.js Production Build Metrics:**
  - Shared JS bundle size: **103 kB** across all routes (compact and lightweight).
  - Largest route: `/monitoring` (**109 kB**, total first load 230 kB) due to Recharts SVG graphing libraries.
  - Initial load across dashboard and explorer ranges between **126 kB – 131 kB**, ensuring rapid delivery on low-bandwidth rural mobile connections.
- **Geospatial Map Performance:**
  - Leaflet map utilizes vector GeoJSON rendering for Bundelkhand blocks.
  - Coordinate markers are lightweight and render smoothly without frame drops.

---

## 2. Accessibility (a11y) & UX Evaluation
- **Color Contrast & Theme:** Warm neutral background (`#f8f7f4`) with high-contrast slate text (`#1a202c`) ensures WCAG AA compliance for daylight readability.
- **Design Rule Adherence:** Zero eye-straining neon accents or low-contrast dark themes.
- **Keyboard Navigation & Semantics:**
  - Semantic HTML (`<nav>`, `<main>`, `<header>`, `<table>`, `<button>`).
  - Interactive tabs and dropdown filters support standard focus rings and keyboard interaction.
- **Localization:**
  - Instantaneous bilingual switching between Hindi and English covers all core navigation elements and scientific disclaimers.
