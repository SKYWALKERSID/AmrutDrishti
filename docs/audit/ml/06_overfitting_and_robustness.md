# JAL DRISHTI — Overfitting, Underfitting & Robustness Audit
**Audit Date**: October 13, 2026  
**Document**: `06_overfitting_and_robustness.md`  

---

## 1. Generalization Diagnosis by Pilot Block

| Pilot Block | Generalization Diagnosis | Supporting Evidence | Vulnerability Factor |
|---|---|---|---|
| **Bijawar** | **Reasonably Supported / Underfitting** | Test RMSE (3.59m) beats baseline (4.98m). Error remains $\sim 3$m due to sparse autoregressive inputs missing localized fracture recharge. | High seasonal drawdown dynamic |
| **Rajnagar** | **Reasonably Supported** | Consistent improvement over baseline (+23.5%). Test residuals spread evenly across wet/dry transitions. | Weathered mantle buffer |
| **Baldeogarh** | **Potentially Overfit / Small Sample** | Test RMSE 0.84m looks strong, but test set size is only $N=4$. High risk that 4 points were coincidentally easy to fit. | Sample starvation ($N_{train}=14$) |
| **Jatara** | **Reasonably Supported** | $N=65$ samples. Solid 31% reduction in test error. Moderate generalization stability. | Granite fracture recharge |
| **Palera** | **Clearly Overfit (Sample Artifact)** | Test RMSE $0.001$m and NSE $1.000$ on $N=3$ test samples. 100 boosted trees memorized 10 training points. | Extreme sample starvation ($N=13$) |
| **Tikamgarh** | **Underfitting / Specification Error** | ML model performed worse than the Seasonal Persistence baseline (3.61m vs 2.15m). | Incomplete exogenous feature alignment |

---

## 2. Robustness Stress Tests

### Sensitivity to Missing Inputs
When `water_level_lag_1` or `lag_2` is missing, `build_block_training_matrix` currently drops the row (`dropna`). This results in discarding entire quarters if a single well observation was missed.

### Monotonicity Violations ($P_{10} \le P_{50} \le P_{90}$)
Because independent regressors are fitted for each percentile:
- In **Baldeogarh**: $P_{10} = 2.86$m, $P_{50} = 2.16$m, $P_{90} = 5.00$m. (Here $P_{10} > P_{50}$, which is a physical impossibility for quantiles).
- In **Rajnagar**: Quantile inversion also detected on test edge cases.
- **Root Cause**: Quantile gradient boosting without simultaneous multi-output constraints or monotonic sorting produces quantile crossing under small sample sizes.

### Outlier Sensitivity
In hard rock aquifers, heavy pumping during Rabi sowing can cause sudden 10m drawdowns that recover by next monsoon. The current squared error and L1 quantile loss with `max_depth=3` handles moderate outliers, but on sample sizes $< 20$, single extreme readings distort leaf partitions.
