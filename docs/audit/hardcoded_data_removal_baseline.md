# Baseline Audit: Hardcoded Data Removal, Live Data Wiring & Loading States

**Repository:** SKYWALKERSID/JalDrishti  
**Date:** 2026-10-13  
**Status:** Completed Baseline Audit (Phase A)  
**Governing Directives:** PRD §4.3, §6, §7; TRD §7; Master Vibe-Coding Prompt §5 (Scientific Integrity)

---

## 1. Executive Summary

This repository-wide baseline audit identifies every hardcoded demonstration value, simulated metric, fixture fallback branch, and premature rendering path in JalDrishti. 

The investigation confirms that **verified government-source data integrations (CGWB manual wells, NWIC telemetry, and Supabase PostGIS/historical tables) already exist in the codebase**. However, multiple production-facing pages and services:
1. **Render hardcoded fixtures during initial load/hydration** before asynchronous API requests resolve (Flash-of-Demo).
2. **Fall back silently to hardcoded fixtures (`ALL_BLOCKS`, `HISTORICAL_TIMESERIES`, `INITIAL_INTERVENTIONS`, `INITIAL_NOTIFICATIONS`)** whenever an API returns an empty array, experiences network latency, or throws an error.
3. **Improperly convert `null` measurements into `0`** via `?? 0` or `|| 0` operators.
4. **Fabricate synthetic environmental readings** (e.g. synthetic GRACE TWSA and rainfall in historical monitoring charts).

This document establishes the exhaustive inventory of all affected components, data flows, and remediation requirements.

---

## 2. Inventory of Hardcoded Data & Fallback Paths

### A. Shared Services & API Routes

| File & Lines | Identified Hardcoded / Fallback Pattern | Root Cause & Runtime Behavior | Remediation Required |
| :--- | :--- | :--- | :--- |
| `src/lib/services/geospatialService.ts`<br>(Lines 37–44, 48, 71, 75, 101, 122) | `const demo = (message: string) => ({ blocks: ALL_BLOCKS, source: 'demonstration_fixture', ... })` | When Supabase environment is unconfigured, returns 0 units, has 0 indicators, or throws an exception, the service returns the 12-block hardcoded Bundelkhand fixture instead of an honest empty/error response. | Remove `ALL_BLOCKS` fallback. Return `blocks: []`, `source: 'fallback_empty'`, and the explicit error message. |
| `src/lib/mappers/blockMapper.ts`<br>(Lines 168, 170, 195) | `descriptiveStressScore: 0`<br>`dataStatus: 'simulated'`<br>`indicator.descriptive_stress_score ?? calculated.score ?? 0` | When derived indicators are null, the mapper coerces missing score to `0` and sets status to `'simulated'`. Non-null mapping coerces missing scores to `0` instead of preserving `null`. | Preserve `null` for uncomputed scores. Never assign `0` as an indicator score for missing data. Set `riskSeverity: 'gap'`. |
| `src/app/api/forecast/route.ts`<br>(Lines 65–67) | `const block = ALL_BLOCKS.find(...) \|\| ALL_BLOCKS[0];` | Resolves requested block slug against the static `ALL_BLOCKS` array and falls back to `ALL_BLOCKS[0]` if not matched. | Resolve unit from database or return an honest `404 Block Not Found` error rather than substituting `ALL_BLOCKS[0]`. |
| `src/app/api/geospatial/blocks/route.ts`<br>(Lines 14–17) | `source: 'fallback_empty'`, `isDemonstrationData: true` | Returns 500 status on service exception with empty blocks. | Ensure frontend components display honest error states rather than falling back to local demo fixtures. |

---

### B. Production Pages & UI Components

#### 1. Overview Dashboard (`src/app/page.tsx`)
* **Lines 25, 62–68, 76:** 
  ```ts
  const [blocksData, setBlocksData] = useState<BlockData[]>([]);
  ...
  if (active) setBlocksData(ALL_BLOCKS);
  ...
  const displayBlocks = blocksData.length > 0 ? blocksData : ALL_BLOCKS;
  ```
  * **Failure mode:** On first paint, `blocksData` is `[]`, causing `displayBlocks` to immediately render `ALL_BLOCKS`. If `/api/geospatial/blocks` fails, `setBlocksData(ALL_BLOCKS)` is called.
  * **Remediation:** Initialize `isLoading: true`. Render a loading skeleton while fetching. If the API returns empty or fails, display an explicit empty/error banner. Never substitute `ALL_BLOCKS`.

#### 2. Map Explorer (`src/components/MapExplorer.tsx`)
* **Lines 32–34, 101–102, 113, 161:**
  ```ts
  const [selectedBlock, setSelectedBlock] = useState<BlockData>(
    ALL_BLOCKS.find((b) => b.id === initialBlockId) || ALL_BLOCKS[0]
  );
  ...
  const activeScopeBlocks: BlockData[] =
    mapScope === 'bundelkhand' ? (blocksData.length > 0 ? blocksData : ALL_BLOCKS) : ...;
  ...
  setSelectedBlock(ALL_BLOCKS[0]);
  ```
  * **Failure mode:** Flash-of-demo on initial render. Fallback to `ALL_BLOCKS` if backend fails.
  * **Remediation:** Track `isLoading`. Render map loading layer and skeleton inspector while loading. If Bundelkhand blocks are unavailable from the DB, display an explicit "Data unavailable" panel. In National Contrast mode, use verified empirical CGWB observations.

#### 3. Monitoring Workspace (`src/app/monitoring/page.tsx`)
* **Lines 25–32:** `const HISTORICAL_TIMESERIES = [ ... ]` (6 static points from Oct 2021 to Oct 2026).
* **Lines 40, 111, 116, 220, 253:**
  ```ts
  const [selectedBlockId, setSelectedBlockId] = useState<string>(ALL_BLOCKS[0].id);
  ...
  if (chartPoints.length > 0) setHistoricalData(chartPoints);
  else setHistoricalData(HISTORICAL_TIMESERIES);
  ...
  <LineChart data={historicalData.length > 0 ? historicalData : HISTORICAL_TIMESERIES} />
  ```
* **Lines 104–105:** Fabricates synthetic GRACE anomaly (`-5.0 - (item.sum / item.count) * 0.2`) and synthetic rainfall (`item.date.includes('-08-') ? 780 : 150`) into genuine CGWB well observations!
  * **Failure mode:** Silently displays fabricated demonstration chart when genuine observations are empty or loading. Mixes fabricated satellite data into real well readings.
  * **Remediation:** Remove `HISTORICAL_TIMESERIES` and synthetic calculation formulas. Show chart skeleton during loading. If no observations exist, display an explicit "No published historical observations available for this block." Show actual observed well depths without fabricated companion series.

#### 4. Risk Assessment & Scoring (`src/app/risk-assessment/page.tsx`)
* **Lines 20, 41, 54:**
  ```ts
  const [selectedBlockId, setSelectedBlockId] = useState<string>(ALL_BLOCKS[0].id);
  const displayBlocks = blocksData.length > 0 ? blocksData : ALL_BLOCKS;
  const selectedBlock = displayBlocks.find(b => b.id === selectedBlockId) || displayBlocks[0];
  ```
  * **Failure mode:** Renders hardcoded scores from `ALL_BLOCKS[0]` prior to fetch resolution.
  * **Remediation:** Show loading skeleton. If backend returns empty/error, show "Risk score unavailable — Required verified inputs are missing". If indicators have data gaps, display `gap` severity and null score.

#### 5. Interventions (`src/app/interventions/page.tsx`)
* **Lines 23, 33, 116, 504:**
  ```ts
  const [proposals, setProposals] = useState<InterventionProposal[]>(INITIAL_INTERVENTIONS);
  const [blockId, setBlockId] = useState(ALL_BLOCKS[0].id);
  const selectedBlock = ALL_BLOCKS.find(b => b.id === blockId) || ALL_BLOCKS[0];
  ...
  {ALL_BLOCKS.map(b => ...)}
  ```
  * **Failure mode:** Uses static `INITIAL_INTERVENTIONS` and `ALL_BLOCKS` for block dropdowns.
  * **Remediation:** Wire proposal state to `/api/interventions` with loading state and honest empty state. Populate block choices dynamically from `/api/geospatial/blocks`.

#### 6. Alerts & SMS Notifications (`src/app/alerts/page.tsx`)
* **Lines 30–31, 83, 255:**
  ```ts
  const [notifications, setNotifications] = useState<NotificationRecord[]>(INITIAL_NOTIFICATIONS);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(ALL_BLOCKS[0].id);
  const selectedBlock = ALL_BLOCKS.find(b => b.id === selectedBlockId) || ALL_BLOCKS[0];
  ```
  * **Failure mode:** Direct dependency on static `INITIAL_NOTIFICATIONS` and `ALL_BLOCKS`.
  * **Remediation:** Populate blocks from `/api/geospatial/blocks`. Show loading state. Display empty advisory log state when no dispatches exist.

---

## 3. Data Flow & Provenance Truth Table

| Route | Target Data Source | Current Fallback Vulnerability | Target Honest State |
| :--- | :--- | :--- | :--- |
| `/` | `/api/geospatial/blocks` (Supabase DB) | `ALL_BLOCKS` (fixture) | Loading skeleton -> Live rows OR Empty/Error Banner |
| `/explorer` | `/api/geospatial/blocks` & `nationalContrast.ts` (CGWB) | `ALL_BLOCKS` (fixture) | Layer loader -> Genuine markers OR Layer unavailable notice |
| `/monitoring` | `/api/historical-observations` & `/api/forecast` | `HISTORICAL_TIMESERIES` (fake array) | Chart skeleton -> Real CGWB series OR "No published records" |
| `/risk-assessment`| `/api/geospatial/blocks` + `calculateDescriptiveGss` | `ALL_BLOCKS` (fixture) | Loading skeleton -> Real GSS calculation OR "Inputs missing" |
| `/interventions` | `/api/interventions` (PostgreSQL) | `INITIAL_INTERVENTIONS` (fixture) | Table skeleton -> Stored proposals OR "No proposals logged" |
| `/alerts` | `/api/geospatial/blocks` + `/api/alerts/dispatch` | `INITIAL_NOTIFICATIONS` (fixture) | Form loader -> Active blocks OR "No notifications logged" |
| `/data-sources` | Data Registry + Connectivity checks | Static metadata only | Documented vs Connected vs Ingested vs Validated |
| `/admin` | `/api/audit` | Memory log fallback | Audit log table -> Live PostgreSQL events OR Memory log |

---

## 4. Phase-by-Phase Remediation Roadmap

1. **Phase B (Shared Services & Mappers):**
   - Refactor `src/lib/services/geospatialService.ts` to eliminate `demo()` fallback returning `ALL_BLOCKS`.
   - Update `src/lib/mappers/blockMapper.ts` to strictly preserve `null` for unobserved indicators and uncomputed stress scores.
   - Refactor `src/app/api/forecast/route.ts` to remove `ALL_BLOCKS[0]` fallback and return genuine 404 / unavailable payloads.

2. **Phase C (Page Remediation):**
   - **Overview:** Add `isLoading` skeleton states and honest empty/error screens; remove `ALL_BLOCKS` fallback.
   - **Map Explorer:** Add loading layer indicators; remove `ALL_BLOCKS` fallback.
   - **Monitoring:** Remove `HISTORICAL_TIMESERIES` and synthetic companion formulas; add chart loading skeletons and explicit empty messages.
   - **Risk Assessment:** Add loading state and explicit data-gap handling for missing inputs.
   - **Interventions & Alerts:** Fetch live blocks from `/api/geospatial/blocks`; remove static `ALL_BLOCKS` imports.

3. **Phase D (Automated Regression Tests):**
   - Build tests in `tests/` verifying that loading renders skeletons, empty responses render empty messages, errors render error states, and no fixture measurements appear in the production path.

4. **Phase E (Verification & Final Report):**
   - Run type checks (`tsc --noEmit`), test suites (`npm test`), and production build (`npm run build`).
   - Create `docs/audit/hardcoded_data_removal_final_report.md`.
