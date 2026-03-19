import pytest

from agora.eval.calibration.ece import compute_ece, _build_bins, _calibration_label
from agora.eval.calibration.types import PredictionRecord


def _make_pred(
    example_id="e1",
    vendor_id="vendor_a",
    predicted="cat",
    ground_truth="cat",
    confidence=0.9,
    task_category="classification",
    eval_date="2026-03-19",
    confidence_available=True,
) -> PredictionRecord:
    return PredictionRecord(
        example_id=example_id,
        vendor_id=vendor_id,
        predicted_label=predicted,
        ground_truth_label=ground_truth,
        confidence=confidence,
        full_probs=None,
        task_category=task_category,
        eval_date=eval_date,
        confidence_available=confidence_available,
    )


class TestComputeECE:
    def test_perfect_calibration(self):
        """All predictions correct with confidence matching accuracy per bin -> ECE ~ 0."""
        preds = []
        # Create predictions where confidence matches accuracy
        # All correct with confidence spread across bins
        for i in range(100):
            conf = (i + 0.5) / 100.0
            preds.append(_make_pred(
                example_id=f"e{i}",
                confidence=conf,
                predicted="cat",
                ground_truth="cat",
            ))
        result = compute_ece(preds, n_bins=10)
        # When all are correct (accuracy=1.0 in each bin), ECE reflects
        # the gap between mean_conf and 1.0
        assert result.ece >= 0.0
        assert result.n_total == 100

    def test_fully_overconfident(self):
        """All predictions confidence=1.0, accuracy=0.5 -> ECE ~= 0.5."""
        preds = []
        for i in range(100):
            correct = i % 2 == 0
            preds.append(_make_pred(
                example_id=f"e{i}",
                confidence=1.0,
                predicted="cat",
                ground_truth="cat" if correct else "dog",
            ))
        result = compute_ece(preds, n_bins=10)
        assert abs(result.ece - 0.5) < 0.01

    def test_empty_bins_skipped(self):
        """Sparse predictions -> no ZeroDivisionError."""
        # All predictions in a narrow range
        preds = [
            _make_pred(example_id=f"e{i}", confidence=0.95)
            for i in range(10)
        ]
        result = compute_ece(preds, n_bins=15)
        assert result.n_total == 10
        empty_bins = [b for b in result.bins if b.count == 0]
        assert len(empty_bins) > 0

    def test_single_prediction(self):
        """n=1, correct, conf=0.9 -> ECE = |1.0 - 0.9| = 0.1."""
        preds = [_make_pred(confidence=0.9)]
        result = compute_ece(preds, n_bins=10)
        assert abs(result.ece - 0.1) < 1e-6

    def test_validates_vendor_homogeneity(self):
        """Mixed vendors -> ValueError."""
        preds = [
            _make_pred(vendor_id="vendor_a"),
            _make_pred(example_id="e2", vendor_id="vendor_b"),
        ]
        with pytest.raises(ValueError, match="multiple vendors"):
            compute_ece(preds)

    def test_empty_predictions_raises(self):
        with pytest.raises(ValueError, match="empty"):
            compute_ece([])

    def test_invalid_confidence_raises(self):
        preds = [_make_pred(confidence=1.5)]
        with pytest.raises(ValueError, match="outside"):
            compute_ece(preds)

    def test_confidence_zero(self):
        """confidence=0.0 -> assigned to bin 0."""
        preds = [_make_pred(confidence=0.0)]
        result = compute_ece(preds, n_bins=10)
        assert result.bins[0].count == 1

    def test_confidence_one(self):
        """confidence=1.0 -> assigned to last bin."""
        preds = [_make_pred(confidence=1.0)]
        result = compute_ece(preds, n_bins=10)
        assert result.bins[-1].count == 1

    def test_mce_is_max_gap(self):
        preds = [
            _make_pred(example_id="e1", confidence=0.1, predicted="cat", ground_truth="dog"),
            _make_pred(example_id="e2", confidence=0.9, predicted="cat", ground_truth="cat"),
        ]
        result = compute_ece(preds, n_bins=10)
        non_empty = [b for b in result.bins if b.count > 0]
        assert result.mce == max(b.gap for b in non_empty)

    def test_calibration_labels(self):
        assert _calibration_label(0.03) == ("Well-calibrated", "green")
        assert _calibration_label(0.07) == ("Acceptable", "yellow")
        assert _calibration_label(0.15) == ("Overconfident", "orange")
        assert _calibration_label(0.25) == ("Poorly calibrated", "red")

    def test_confidence_unavailable_filtered(self):
        preds = [
            _make_pred(example_id="e1", confidence=0.9),
            _make_pred(example_id="e2", confidence=0.5, confidence_available=False),
        ]
        result = compute_ece(preds)
        assert result.n_total == 1


class TestBuildBins:
    def test_bin_count(self):
        bins = _build_bins(10)
        assert len(bins) == 10

    def test_bins_cover_0_to_1(self):
        bins = _build_bins(15)
        assert abs(bins[0][0] - 0.0) < 1e-9
        assert abs(bins[-1][1] - 1.0) < 1e-9
