import pytest

from agora.eval.calibration.ece import compute_adaptive_ece
from agora.eval.calibration.types import PredictionRecord


def _pred(confidence, correct=True, example_id="e1"):
    gt = "a"
    predicted = "a" if correct else "b"
    return PredictionRecord(
        example_id=example_id,
        vendor_id="v1",
        predicted_label=predicted,
        ground_truth_label=gt,
        confidence=confidence,
        full_probs=None,
        task_category="test",
        eval_date="2026-03-21",
    )


class TestAdaptiveECE:
    def test_perfect_calibration(self):
        """All predictions correct with confidence 1.0 → ECE = 0."""
        preds = [_pred(1.0, correct=True, example_id=f"e{i}") for i in range(100)]
        result = compute_adaptive_ece(preds, n_bins=10)
        assert result == pytest.approx(0.0)

    def test_returns_none_for_no_confidence(self):
        pred = _pred(0.5)
        pred.confidence_available = False
        assert compute_adaptive_ece([pred]) is None

    def test_equal_frequency_bins(self):
        """With uniform confidences, equal-frequency should give bins of equal size."""
        import random
        random.seed(42)
        preds = []
        for i in range(100):
            conf = (i + 0.5) / 100  # uniform spread from 0.005 to 0.995
            correct = random.random() < conf
            preds.append(_pred(conf, correct=correct, example_id=f"e{i}"))

        result = compute_adaptive_ece(preds, n_bins=10)
        assert result is not None
        assert 0.0 <= result <= 1.0

    def test_overconfident_model(self):
        """Model always predicts 0.9 confidence but only 50% correct.
        With equal-frequency binning and all same confidence,
        the ECE depends on how correct/incorrect predictions distribute across bins.
        """
        preds = []
        for i in range(100):
            correct = i < 50
            preds.append(_pred(0.9, correct=correct, example_id=f"e{i}"))

        result = compute_adaptive_ece(preds, n_bins=5)
        assert result is not None
        # Overall gap is |0.5 - 0.9| = 0.4, but bin-level varies
        assert 0.3 <= result <= 0.6

    def test_single_bin(self):
        """With 1 bin, adaptive ECE = |mean_conf - accuracy|."""
        preds = [
            _pred(0.8, correct=True, example_id="e1"),
            _pred(0.8, correct=False, example_id="e2"),
        ]
        result = compute_adaptive_ece(preds, n_bins=1)
        # accuracy = 0.5, mean_conf = 0.8, gap = 0.3
        assert result == pytest.approx(0.3)

    def test_more_bins_than_predictions(self):
        """Handles case where n_bins > n_predictions gracefully."""
        preds = [
            _pred(0.9, correct=True, example_id="e1"),
            _pred(0.1, correct=False, example_id="e2"),
        ]
        result = compute_adaptive_ece(preds, n_bins=10)
        assert result is not None
        assert 0.0 <= result <= 1.0
