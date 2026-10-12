"""
JalDrishti ML Pipeline - Evaluation & Validation Harness
Calculates hydrological benchmark metrics and checks model acceptance criteria
adhering to Section 5 of JalDrishti Workspace Rules.
"""

from typing import Dict, Any, List
import math

class HydrologicalEvaluator:
    """
    Evaluates groundwater model predictions against held-out observations.
    Computes RMSE, MAE, Nash-Sutcliffe Efficiency (NSE), and Baseline Improvement Ratio.
    """
    def __init__(self, acceptance_thresholds: Optional[Dict[str, float]] = None):
        self.thresholds = acceptance_thresholds or {
            "max_rmse_m": 1.50,
            "max_mae_m": 1.00,
            "min_nse": 0.65,
            "min_improvement_over_baseline": 0.15
        }

    def evaluate(
        self,
        y_true: List[float],
        y_pred: List[float],
        baseline_pred: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Computes all standard validation metrics.
        """
        pairs = [(t, p) for t, p in zip(y_true, y_pred) if t is not None and p is not None]
        if not pairs:
            return {"error": "No valid observation-prediction pairs"}

        n = len(pairs)
        errors = [p - t for t, p in pairs]
        squared_errors = [e ** 2 for e in errors]
        abs_errors = [abs(e) for e in errors]

        rmse = math.sqrt(sum(squared_errors) / n)
        mae = sum(abs_errors) / n

        # Nash-Sutcliffe Efficiency (NSE)
        mean_obs = sum(t for t, _ in pairs) / n
        variance_obs = sum((t - mean_obs) ** 2 for t, _ in pairs)
        nse = 1.0 - (sum(squared_errors) / variance_obs) if variance_obs > 0 else 0.0

        improvement = None
        if baseline_pred:
            base_pairs = [(t, bp) for t, bp in zip(y_true, baseline_pred) if t is not None and bp is not None]
            if base_pairs:
                base_rmse = math.sqrt(sum((bp - t) ** 2 for t, bp in base_pairs) / len(base_pairs))
                improvement = (base_rmse - rmse) / base_rmse if base_rmse > 0 else 0.0

        is_accepted = (
            rmse <= self.thresholds["max_rmse_m"] and
            mae <= self.thresholds["max_mae_m"] and
            nse >= self.thresholds["min_nse"] and
            (improvement is None or improvement >= self.thresholds["min_improvement_over_baseline"])
        )

        return {
            "sample_count": n,
            "rmse_m": round(rmse, 3),
            "mae_m": round(mae, 3),
            "nse": round(nse, 3),
            "baseline_improvement_ratio": round(improvement, 3) if improvement is not None else None,
            "meets_scientific_standards": is_accepted
        }
