# JalDrishti — Phase Seven: Rainfall & IMD Integration Audit

**Document File:** `docs/audit/07_rainfall_integration_audit.md`  
**Official Data Source:** India Meteorological Department (IMD) Pune 0.25° × 0.25° Gridded Daily Rainfall NetCDF product.

---

## 1. Adapter Implementation Inspection
- **Implementing Module:** [`src/lib/adapters/imdRainfallAdapter.ts`](file:///D:/Projects/JalDrishti/src/lib/adapters/imdRainfallAdapter.ts)
- **Staged Sample File:** [`data/sources/imd_rainfall_staged_sample.csv`](file:///D:/Projects/JalDrishti/data/sources/imd_rainfall_staged_sample.csv)
- **Calculation Service:** [`src/lib/services/rainfallCalculationService.ts`](file:///D:/Projects/JalDrishti/src/lib/services/rainfallCalculationService.ts)

### NetCDF Parser Capabilities
- Uses `netcdfjs` to parse binary NetCDF structures.
- Extracts spatial dimensions (`latitude`, `longitude`), time coordinates, and the primary variable (`rainfall` / `rain`).
- Bounds check: Validates grid spacing ($0.25^\circ$) and coordinates covering Central India ($66.5^\circ\text{E} - 100.0^\circ\text{E}, 6.5^\circ\text{N} - 38.5^\circ\text{N}$).
- Rejects negative rainfall values ($< 0.0\text{ mm}$) and flags fill/missing values (typically $-999.0$ or $9999.0$) as `null`.

---

## 2. SPI-3 (Standardized Precipitation Index) Methodology
- **Accumulation Window:** 3-month rolling precipitation sum.
- **Baseline Requirements:** Enforces a minimum 20-year (ideally 30-year) climatological normal. Rejects datasets with insufficient history.
- **Fitting & Standardization:** Computes standard normal deviate $Z = (X - \mu) / \sigma$.
- **WMO Category Compliance:** Verified against WMO guidelines:
  - $\text{SPI} \le -2.00$: Extremely Dry
  - $-1.99 \le \text{SPI} \le -1.50$: Severely Dry
  - $-1.49 \le \text{SPI} \le -1.00$: Moderately Dry
  - $-0.99 \le \text{SPI} \le 0.99$: Near Normal
  - $\text{SPI} \ge +1.00$: Wet conditions

---

## 3. Operational Gaps & Next Steps
- **Unit Test Coverage:** [`tests/imdRainfallIntegration.test.ts`](file:///D:/Projects/JalDrishti/tests/imdRainfallIntegration.test.ts) passes 100%.
- **Missing Automation:** Daily automated FTP/HTTP ingestion cron from IMD Pune is not yet deployed; currently processes local staged CSV/NetCDF files.
