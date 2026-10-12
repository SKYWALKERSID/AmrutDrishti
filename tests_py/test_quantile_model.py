"""
Regression tests for QuantileGroundwaterModel and quantile crossing safeguards.
Verifies fitting, output keys, shapes, crossing detection, and ordering.
"""
import unittest
import numpy as np
import pandas as pd
from ml.models import QuantileGroundwaterModel
from ml.validation import quantile_crossings, order_quantiles


class TestQuantileModel(unittest.TestCase):
    def setUp(self):
        # Create deterministic synthetic dataset with clear trend
        np.random.seed(42)
        n = 100
        x1 = np.linspace(5.0, 20.0, n)
        x2 = np.sin(np.linspace(0, 4 * np.pi, n))
        self.X = pd.DataFrame({"feat1": x1, "feat2": x2})
        self.y = pd.Series(x1 * 0.8 + x2 * 1.5 + np.random.normal(0, 0.5, n))

    def test_model_fit_and_predict_shapes(self):
        model = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
        model.fit(self.X, self.y)

        preds = model.predict(self.X)
        self.assertIn("p10", preds)
        self.assertIn("p50", preds)
        self.assertIn("p90", preds)

        self.assertEqual(len(preds["p10"]), len(self.X))
        self.assertEqual(len(preds["p50"]), len(self.X))
        self.assertEqual(len(preds["p90"]), len(self.X))

        # Check finite values
        self.assertTrue(np.all(np.isfinite(preds["p10"])))
        self.assertTrue(np.all(np.isfinite(preds["p50"])))
        self.assertTrue(np.all(np.isfinite(preds["p90"])))

    def test_quantile_crossings_detection(self):
        # Normal ordered: p10 <= p50 <= p90
        p10 = [2.0, 3.0, 4.0]
        p50 = [5.0, 6.0, 7.0]
        p90 = [8.0, 9.0, 10.0]
        crossings = quantile_crossings(p10, p50, p90)
        self.assertFalse(np.any(crossings))

        # Violation where p10 > p50
        p10_bad = [6.0, 3.0, 4.0]
        p50_bad = [5.0, 6.0, 7.0]
        p90_bad = [8.0, 9.0, 10.0]
        crossings_bad1 = quantile_crossings(p10_bad, p50_bad, p90_bad)
        self.assertTrue(crossings_bad1[0])
        self.assertFalse(crossings_bad1[1])

        # Violation where p50 > p90
        p50_bad2 = [5.0, 6.0, 11.0]
        crossings_bad2 = quantile_crossings(p10, p50_bad2, p90)
        self.assertTrue(crossings_bad2[2])

    def test_order_quantiles_safeguard(self):
        # Unordered predictions
        p10_raw = [6.0, 3.0, 10.0]
        p50_raw = [4.0, 5.0, 8.0]
        p90_raw = [8.0, 2.0, 7.0]

        p10_sorted, p50_sorted, p90_sorted = order_quantiles(p10_raw, p50_raw, p90_raw)

        # For index 0: values [6, 4, 8] -> sorted [4, 6, 8]
        self.assertEqual(p10_sorted[0], 4.0)
        self.assertEqual(p50_sorted[0], 6.0)
        self.assertEqual(p90_sorted[0], 8.0)

        # For index 1: values [3, 5, 2] -> sorted [2, 3, 5]
        self.assertEqual(p10_sorted[1], 2.0)
        self.assertEqual(p50_sorted[1], 3.0)
        self.assertEqual(p90_sorted[1], 5.0)

        # For index 2: values [10, 8, 7] -> sorted [7, 8, 10]
        self.assertEqual(p10_sorted[2], 7.0)
        self.assertEqual(p50_sorted[2], 8.0)
        self.assertEqual(p90_sorted[2], 10.0)

        # Check crossings on sorted output is 0
        new_crossings = quantile_crossings(p10_sorted, p50_sorted, p90_sorted)
        self.assertFalse(np.any(new_crossings))


if __name__ == "__main__":
    unittest.main()
