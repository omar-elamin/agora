import pytest

from agora.eval.calibration.fds_auroc import compute_fds_auroc, _auroc_trapezoidal
from agora.eval.calibration.types import PredictionRecord


def _pred(predicted, ground_truth, confidence, example_id="e1"):
    return PredictionRecord(
        example_id=example_id,
        vendor_id="v1",
        predicted_label=predicted,
        ground_truth_label=ground_truth,
        confidence=confidence,
        full_probs=None,
        task_category="test",
        eval_date="2026-03-21",
    )


class TestFDSAuroc:
    def test_perfect_discrimination(self):
        """All correct predictions have higher confidence than all wrong ones."""
        preds = [
            _pred("a", "a", 0.9, f"e{i}") for i in range(60)
        ] + [
            _pred("a", "b", 0.1, f"e{i+60}") for i in range(60)
        ]
        result = compute_fds_auroc(preds)
        assert result.fds == pytest.approx(1.0)
        assert result.n_correct == 60
        assert result.n_errors == 60
        assert not result.insufficient_errors

    def test_random_discrimination(self):
        """Same confidence for all → AUROC ≈ 0.5."""
        preds = [
            _pred("a", "a", 0.5, f"e{i}") for i in range(60)
        ] + [
            _pred("a", "b", 0.5, f"e{i+60}") for i in range(60)
        ]
        result = compute_fds_auroc(preds)
        assert result.fds == pytest.approx(0.5, abs=0.01)

    def test_all_correct(self):
        """All predictions correct → insufficient errors, AUROC = 0.5."""
        preds = [_pred("a", "a", 0.9, f"e{i}") for i in range(100)]
        result = compute_fds_auroc(preds)
        assert result.fds == 0.5
        assert result.insufficient_errors

    def test_insufficient_errors_flag(self):
        """Fewer than 50 errors → flagged as insufficient."""
        preds = [
            _pred("a", "a", 0.9, f"e{i}") for i in range(80)
        ] + [
            _pred("a", "b", 0.1, f"e{i+80}") for i in range(20)
        ]
        result = compute_fds_auroc(preds, min_errors=50)
        assert result.insufficient_errors
        assert result.n_errors == 20
        # AUROC should still be computed
        assert result.fds > 0.5

    def test_sufficient_errors(self):
        """Enough errors → not flagged."""
        preds = [
            _pred("a", "a", 0.9, f"e{i}") for i in range(50)
        ] + [
            _pred("a", "b", 0.1, f"e{i+50}") for i in range(50)
        ]
        result = compute_fds_auroc(preds, min_errors=50)
        assert not result.insufficient_errors

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="empty"):
            compute_fds_auroc([])

    def test_no_confidence_available(self):
        preds = [_pred("a", "a", 0.9)]
        preds[0].confidence_available = False
        result = compute_fds_auroc(preds)
        assert result.insufficient_errors
        assert result.fds == 0.5


class TestAurocTrapezoidal:
    def test_perfect_auroc(self):
        scores = [0.9, 0.8, 0.1, 0.2]
        labels = [1, 1, 0, 0]
        assert _auroc_trapezoidal(scores, labels) == pytest.approx(1.0)

    def test_inverted_auroc(self):
        """All positives have lower scores than negatives → AUROC = 0."""
        scores = [0.1, 0.2, 0.9, 0.8]
        labels = [1, 1, 0, 0]
        assert _auroc_trapezoidal(scores, labels) == pytest.approx(0.0)

    def test_equal_scores(self):
        scores = [0.5, 0.5, 0.5, 0.5]
        labels = [1, 1, 0, 0]
        assert _auroc_trapezoidal(scores, labels) == pytest.approx(0.5)
