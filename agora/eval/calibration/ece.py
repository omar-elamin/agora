from typing import Optional

from agora.eval.calibration.types import BinStats, CalibrationResult, PredictionRecord


def compute_ece(
    predictions: list[PredictionRecord],
    n_bins: int = 15,
    strategy: str = "equal_width",
) -> CalibrationResult:
    """
    Compute Expected Calibration Error for a set of predictions from one vendor.

    Raises:
        ValueError: if predictions list is empty
        ValueError: if predictions span multiple vendors
        ValueError: if any confidence score is outside [0.0, 1.0]
    """
    if not predictions:
        raise ValueError("predictions list is empty")

    vendor_ids = set(p.vendor_id for p in predictions)
    if len(vendor_ids) > 1:
        raise ValueError(
            f"predictions span multiple vendors: {vendor_ids}. "
            "Caller should filter first."
        )

    # Filter out predictions where confidence is not available
    available = [p for p in predictions if p.confidence_available]

    for p in available:
        if p.confidence < 0.0 or p.confidence > 1.0:
            raise ValueError(
                f"confidence score {p.confidence} outside [0.0, 1.0] "
                f"for example {p.example_id}"
            )

    if not available:
        raise ValueError("No predictions with confidence_available=True")

    bins = _build_bins(n_bins)
    binned = _assign_to_bins(available, bins)

    bin_stats_list: list[BinStats] = []
    non_empty_stats: list[BinStats] = []

    for i, (lower, upper) in enumerate(bins):
        stats = _compute_bin_stats(i, lower, upper, binned[i])
        if stats is None:
            # Empty bin — include with count=0
            bin_stats_list.append(BinStats(
                bin_index=i, lower=lower, upper=upper,
                count=0, mean_conf=0.0, accuracy=0.0, gap=0.0,
            ))
        else:
            bin_stats_list.append(stats)
            non_empty_stats.append(stats)

    n_total = len(available)

    if non_empty_stats:
        ece = sum((s.count / n_total) * s.gap for s in non_empty_stats)
        mce = max(s.gap for s in non_empty_stats)
    else:
        ece = 0.0
        mce = 0.0

    ece = round(ece, 6)
    mce = round(mce, 6)

    label, label_color = _calibration_label(ece)

    vendor_id = predictions[0].vendor_id
    task_category = predictions[0].task_category
    eval_date = predictions[0].eval_date

    return CalibrationResult(
        vendor_id=vendor_id,
        task_category=task_category,
        eval_date=eval_date,
        n_total=n_total,
        n_bins=n_bins,
        bins=bin_stats_list,
        ece=ece,
        mce=mce,
        label=label,
        label_color=label_color,
    )


def _build_bins(n_bins: int) -> list[tuple[float, float]]:
    """Return list of (lower, upper) tuples for equal-width bins from 0 to 1."""
    step = 1.0 / n_bins
    return [(i * step, (i + 1) * step) for i in range(n_bins)]


def _assign_to_bins(
    predictions: list[PredictionRecord],
    bins: list[tuple[float, float]],
) -> list[list[PredictionRecord]]:
    """
    Assign each prediction to a bin by confidence score.
    Last bin upper bound is inclusive.
    """
    n_bins = len(bins)
    result: list[list[PredictionRecord]] = [[] for _ in range(n_bins)]
    step = 1.0 / n_bins

    for p in predictions:
        if p.confidence >= 1.0:
            idx = n_bins - 1
        else:
            idx = int(p.confidence / step)
            if idx >= n_bins:
                idx = n_bins - 1
        result[idx].append(p)

    return result


def _compute_bin_stats(
    bin_index: int,
    lower: float,
    upper: float,
    preds_in_bin: list[PredictionRecord],
) -> Optional[BinStats]:
    """
    Compute stats for one bin.
    Returns None if bin is empty.
    """
    if not preds_in_bin:
        return None

    count = len(preds_in_bin)
    mean_conf = sum(p.confidence for p in preds_in_bin) / count
    n_correct = sum(
        1 for p in preds_in_bin if p.predicted_label == p.ground_truth_label
    )
    accuracy = n_correct / count
    gap = abs(accuracy - mean_conf)

    return BinStats(
        bin_index=bin_index,
        lower=lower,
        upper=upper,
        count=count,
        mean_conf=mean_conf,
        accuracy=accuracy,
        gap=gap,
    )


def _calibration_label(ece: float) -> tuple[str, str]:
    """
    Return (label_string, color) based on ECE value.
    """
    if ece < 0.05:
        return ("Well-calibrated", "green")
    elif ece < 0.10:
        return ("Acceptable", "yellow")
    elif ece < 0.20:
        return ("Overconfident", "orange")
    else:
        return ("Poorly calibrated", "red")
