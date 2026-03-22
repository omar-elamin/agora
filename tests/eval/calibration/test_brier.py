import pytest

from agora.eval.calibration.brier import compute_brier_score, decompose_brier_score
from agora.eval.calibration.types import PredictionRecord


def _pred(predicted, ground_truth, confidence, full_probs=None, example_id="e1"):
    return PredictionRecord(
        example_id=example_id,
        vendor_id="v1",
        predicted_label=predicted,
        ground_truth_label=ground_truth,
        confidence=confidence,
        full_probs=full_probs,
        task_category="test",
        eval_date="2026-03-21",
    )


class TestBrierBinary:
    def test_perfect_predictions(self):
        """Perfect confidence on correct predictions → Brier = 0."""
        preds = [
            _pred("a", "a", 1.0, example_id="e1"),
            _pred("b", "b", 1.0, example_id="e2"),
        ]
        assert compute_brier_score(preds) == pytest.approx(0.0)

    def test_worst_predictions(self):
        """Full confidence on wrong predictions → Brier = 1.0."""
        preds = [
            _pred("a", "b", 1.0, example_id="e1"),
            _pred("b", "a", 1.0, example_id="e2"),
        ]
        assert compute_brier_score(preds) == pytest.approx(1.0)

    def test_half_confidence_correct(self):
        """Confidence 0.5 on correct → Brier = (0.5-1)^2 = 0.25."""
        preds = [_pred("a", "a", 0.5)]
        assert compute_brier_score(preds) == pytest.approx(0.25)

    def test_half_confidence_wrong(self):
        """Confidence 0.5 on wrong → Brier = (0.5-0)^2 = 0.25."""
        preds = [_pred("a", "b", 0.5)]
        assert compute_brier_score(preds) == pytest.approx(0.25)

    def test_mixed_binary(self):
        """Mix of correct and incorrect."""
        preds = [
            _pred("a", "a", 0.9, example_id="e1"),  # (0.9-1)^2 = 0.01
            _pred("a", "b", 0.7, example_id="e2"),  # (0.7-0)^2 = 0.49
        ]
        expected = (0.01 + 0.49) / 2
        assert compute_brier_score(preds) == pytest.approx(expected)

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="empty"):
            compute_brier_score([])

    def test_no_confidence_available(self):
        pred = _pred("a", "a", 0.9)
        pred.confidence_available = False
        assert compute_brier_score([pred]) == pytest.approx(0.0)


class TestBrierMulticlass:
    def test_perfect_multiclass(self):
        """Perfect full_probs → Brier = 0."""
        preds = [
            _pred("a", "a", 1.0, full_probs={"a": 1.0, "b": 0.0, "c": 0.0}),
        ]
        assert compute_brier_score(preds) == pytest.approx(0.0)

    def test_uniform_multiclass(self):
        """Uniform probs over 3 classes, correct class is 'a'.
        Brier = (1/3 - 1)^2 + (1/3 - 0)^2 + (1/3 - 0)^2
              = (4/9) + (1/9) + (1/9) = 6/9 = 2/3
        """
        preds = [
            _pred("a", "a", 1/3, full_probs={"a": 1/3, "b": 1/3, "c": 1/3}),
        ]
        assert compute_brier_score(preds) == pytest.approx(2 / 3)

    def test_multiclass_mixed_with_fallback(self):
        """Mix of full_probs and fallback predictions."""
        preds = [
            _pred("a", "a", 0.8, full_probs={"a": 0.8, "b": 0.2}, example_id="e1"),
            _pred("b", "b", 0.9, full_probs=None, example_id="e2"),  # binary fallback
        ]
        # e1: (0.8-1)^2 + (0.2-0)^2 = 0.04 + 0.04 = 0.08
        # e2: (0.9-1)^2 = 0.01 (binary fallback)
        expected = (0.08 + 0.01) / 2
        assert compute_brier_score(preds) == pytest.approx(expected)


class TestBrierDecomposition:
    def test_perfect_predictions(self):
        """Perfect calibration: reliability=0, brier=uncertainty-resolution."""
        preds = [
            _pred("a", "a", 1.0, example_id="e1"),
            _pred("b", "b", 1.0, example_id="e2"),
        ]
        result = decompose_brier_score(preds, n_bins=10)
        # All correct with confidence 1.0 → overall_accuracy=1.0
        # uncertainty = 1.0 * 0.0 = 0.0
        assert result.uncertainty == pytest.approx(0.0)
        assert result.reliability == pytest.approx(0.0)
        assert result.brier_score == pytest.approx(0.0)

    def test_identity_check(self):
        """Brier = Uncertainty - Resolution + Reliability for any input."""
        preds = [
            _pred("a", "a", 0.9, example_id="e1"),
            _pred("a", "b", 0.7, example_id="e2"),
            _pred("b", "b", 0.6, example_id="e3"),
            _pred("a", "a", 0.3, example_id="e4"),
        ]
        result = decompose_brier_score(preds, n_bins=10)
        expected_brier = result.uncertainty - result.resolution + result.reliability
        assert result.brier_score == pytest.approx(expected_brier, abs=1e-5)

    def test_all_same_bin(self):
        """All predictions land in one bin — resolution depends on accuracy vs overall."""
        preds = [
            _pred("a", "a", 0.55, example_id="e1"),
            _pred("a", "b", 0.55, example_id="e2"),
        ]
        result = decompose_brier_score(preds, n_bins=10)
        # Both in bin [0.5, 0.6), n_k=2, mean_conf=0.55, accuracy=0.5
        # overall_accuracy = 0.5
        # reliability = (0.55 - 0.5)^2 = 0.0025
        # resolution = (0.5 - 0.5)^2 = 0.0 (single bin, same as overall)
        # uncertainty = 0.5 * 0.5 = 0.25
        assert result.reliability == pytest.approx(0.0025)
        assert result.resolution == pytest.approx(0.0)
        assert result.uncertainty == pytest.approx(0.25)
        assert result.brier_score == pytest.approx(0.25 - 0.0 + 0.0025)

    def test_empty_raises_valueerror(self):
        """Empty list raises ValueError."""
        with pytest.raises(ValueError):
            decompose_brier_score([])

    def test_no_confidence_available_raises(self):
        """All predictions with confidence_available=False raises ValueError."""
        pred = _pred("a", "a", 0.9)
        pred.confidence_available = False
        with pytest.raises(ValueError):
            decompose_brier_score([pred])
