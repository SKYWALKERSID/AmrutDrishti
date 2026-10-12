# JalDrishti — Phase Ten: Derived Indicators & Scientific Validity Audit

**Document File:** `docs/audit/10_indicator_scientific_validity.md`  
**Specification Reference:** [`docs/scientific/pilot_block_indicator_specification.md`](file:///D:/Projects/JalDrishti/docs/scientific/pilot_block_indicator_specification.md)

---

## 1. Groundwater Stress Score (GSS) Formulation

### Mathematical Specification
$$\text{GSS} = (0.35 \times S_{\text{TWSA}}) + (0.30 \times S_{\text{Well}}) + (0.20 \times S_{\text{Rain}}) + (0.15 \times S_{\text{Soil}})$$
Where each sub-index is scaled to a standard 0–100 risk interval:
- $S_{\text{TWSA}}$: Scaled GRACE terrestrial water storage anomaly.
- $S_{\text{Well}}$: Normalized well depth trend and current depth below ground level.
- $S_{\text{Rain}}$: Seasonal rainfall deficit percentage and SPI-3 severity.
- $S_{\text{Soil}}$: SMAP volumetric soil moisture depletion.

---

## 2. Scientific Integrity & Data Handling Evaluation
- **Null Safety:** Verified via [`tests/scientificEngine.test.ts`](file:///D:/Projects/JalDrishti/tests/scientificEngine.test.ts). If key input observations are unmeasured, GSS returns `null` and assigns severity category `gap` rather than fabricating a score.
- **Trend Orientation:** Deeper water levels correspond to larger numerical `m bgl` values. The OLS regression slope sign is correctly interpreted (positive m bgl slope = deepening water table / increasing stress).
- **Validation Reality:** GSS is an empirical multi-criteria decision index. It is **not** an independently validated hydrological model calibrated against physical aquifer pumping tests. All displays must state this limitation clearly.
