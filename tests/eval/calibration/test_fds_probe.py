import pytest

from agora.eval.calibration.fds_probe import (
    compute_fds,
    _is_error,
    _is_high_conf_error,
    _fds_label,
    _invisible_failure_label,
)
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


def _make_multi_vendor_preds(
    n_examples=20,
    target_error_ids=None,
    other_disagree_ids=None,
    task_category="classification",
):
    """
    Helper to build multi-vendor prediction sets.
    target_error_ids: set of example_ids where target vendor is wrong
    other_disagree_ids: set of example_ids where other vendors disagree with target
    """
    if target_error_ids is None:
        target_error_ids = set()
    if other_disagree_ids is None:
        other_disagree_ids = set()

    vendors = ["vendor_a", "vendor_b", "vendor_c"]
    all_preds: dict[str, list[PredictionRecord]] = {v: [] for v in vendors}

    for i in range(n_examples):
        eid = f"e{i}"
        gt = "cat"

        # Target vendor
        if eid in target_error_ids:
            pred_label = "dog"
        else:
            pred_label = "cat"
        all_preds["vendor_a"].append(_make_pred(
            example_id=eid, vendor_id="vendor_a",
            predicted=pred_label, ground_truth=gt,
            confidence=0.9, task_category=task_category,
        ))

        # Other vendors
        for vid in ["vendor_b", "vendor_c"]:
            if eid in other_disagree_ids:
                other_pred = "dog" if pred_label == "cat" else "cat"
            else:
                other_pred = pred_label
            all_preds[vid].append(_make_pred(
                example_id=eid, vendor_id=vid,
                predicted=other_pred, ground_truth=gt,
                confidence=0.9, task_category=task_category,
            ))

    return all_preds


class TestComputeFDS:
    def test_perfect_fds(self):
        """Every error is detected by cross-vendor disagreement."""
        error_ids = {"e0", "e1", "e2"}
        all_preds = _make_multi_vendor_preds(
            n_examples=10,
            target_error_ids=error_ids,
            other_disagree_ids=error_ids,  # other vendors disagree on all errors
        )
        result = compute_fds("vendor_a", all_preds, "classification")
        assert result.n_errors == 3
        assert result.n_detectable == 3
        assert result.fds_overall == 1.0

    def test_zero_errors(self):
        """Returns fds_overall=1.0 with zero errors."""
        all_preds = _make_multi_vendor_preds(
            n_examples=10,
            target_error_ids=set(),
        )
        result = compute_fds("vendor_a", all_preds, "classification")
        assert result.n_errors == 0
        assert result.fds_overall == 1.0

    def test_insufficient_vendors(self):
        """<2 vendors -> ValueError."""
        preds = {"vendor_a": [_make_pred()]}
        with pytest.raises(ValueError, match="at least 2"):
            compute_fds("vendor_a", preds, "classification")

    def test_target_not_in_predictions(self):
        all_preds = _make_multi_vendor_preds()
        with pytest.raises(ValueError, match="not in all_predictions"):
            compute_fds("vendor_x", all_preds, "classification")

    def test_invisible_failures_counted(self):
        """High-conf errors with vendor agreement -> n_invisible increments."""
        error_ids = {"e0", "e1", "e2"}
        # Other vendors AGREE with target (don't disagree) -> errors not flagged
        all_preds = _make_multi_vendor_preds(
            n_examples=10,
            target_error_ids=error_ids,
            other_disagree_ids=set(),  # no disagreement
        )
        result = compute_fds("vendor_a", all_preds, "classification")
        assert result.n_errors == 3
        assert result.n_detectable == 0
        assert result.n_high_conf_errors == 3  # all errors are high-conf (0.9 >= 0.85)
        assert result.n_invisible == 3

    def test_alignment_skips_missing_examples(self):
        """Partial overlap -> only shared examples used."""
        all_preds = {
            "vendor_a": [
                _make_pred(example_id="e1", vendor_id="vendor_a"),
                _make_pred(example_id="e2", vendor_id="vendor_a"),
                _make_pred(example_id="e3", vendor_id="vendor_a"),
            ],
            "vendor_b": [
                _make_pred(example_id="e1", vendor_id="vendor_b"),
                _make_pred(example_id="e2", vendor_id="vendor_b"),
                # e3 missing
            ],
        }
        result = compute_fds("vendor_a", all_preds, "classification")
        # Only e1 and e2 are aligned
        assert result.n_errors == 0  # both correct
        assert result.fds_overall == 1.0

    def test_no_shared_examples_raises(self):
        all_preds = {
            "vendor_a": [_make_pred(example_id="e1", vendor_id="vendor_a")],
            "vendor_b": [_make_pred(example_id="e2", vendor_id="vendor_b")],
        }
        with pytest.raises(ValueError, match="don't share"):
            compute_fds("vendor_a", all_preds, "classification")

    def test_vendors_in_comparison(self):
        all_preds = _make_multi_vendor_preds()
        result = compute_fds("vendor_a", all_preds, "classification")
        assert sorted(result.vendors_in_comparison) == ["vendor_a", "vendor_b", "vendor_c"]

    def test_fds_high_confidence(self):
        """High-conf errors that are flagged contribute to fds_high_confidence."""
        error_ids = {"e0", "e1"}
        disagree_ids = {"e0"}  # only e0 flagged
        all_preds = _make_multi_vendor_preds(
            n_examples=10,
            target_error_ids=error_ids,
            other_disagree_ids=disagree_ids,
        )
        result = compute_fds("vendor_a", all_preds, "classification")
        assert result.n_high_conf_errors == 2
        assert result.fds_high_confidence == 0.5


class TestHelpers:
    def test_is_error(self):
        assert _is_error(_make_pred(predicted="cat", ground_truth="dog"))
        assert not _is_error(_make_pred(predicted="cat", ground_truth="cat"))

    def test_is_high_conf_error(self):
        assert _is_high_conf_error(
            _make_pred(predicted="cat", ground_truth="dog", confidence=0.9), 0.85
        )
        assert not _is_high_conf_error(
            _make_pred(predicted="cat", ground_truth="dog", confidence=0.5), 0.85
        )

    def test_fds_label(self):
        assert _fds_label(0.90)[0] == "Most failures catchable"
        assert _fds_label(0.75)[0] == "Partially detectable"
        assert _fds_label(0.50)[0] == "High hidden failure risk"

    def test_invisible_failure_label(self):
        assert _invisible_failure_label(0.003)[0] == "Low risk"
        assert _invisible_failure_label(0.01)[0] == "Moderate risk"
        assert _invisible_failure_label(0.03)[0] == "High risk — review before production"
