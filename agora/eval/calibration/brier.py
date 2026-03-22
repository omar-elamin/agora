"""Brier Score computation for binary and multiclass predictions."""

from agora.eval.calibration.types import BrierDecomposition, PredictionRecord


def compute_brier_score(predictions: list[PredictionRecord]) -> float:
    """
    Compute Brier Score for a list of predictions.

    Binary case: (1/n) * sum((confidence_i - correct_i)^2)
    Multiclass case: uses full_probs if available, otherwise falls back to
    max-class confidence (binary-style).

    For multiclass with full_probs, the Brier Score is:
        (1/n) * sum_i( sum_k( (p_ik - y_ik)^2 ) )
    where p_ik is the predicted probability for class k and y_ik is 1 if
    the ground truth is class k, else 0.

    Raises:
        ValueError: if predictions list is empty
    """
    if not predictions:
        raise ValueError("predictions list is empty")

    available = [p for p in predictions if p.confidence_available]
    if not available:
        return 0.0

    # Check if any prediction has full_probs (multiclass mode)
    has_full_probs = any(p.full_probs is not None for p in available)

    if has_full_probs:
        return _brier_multiclass(available)
    else:
        return _brier_binary(available)


def decompose_brier_score(
    predictions: list[PredictionRecord], n_bins: int = 10
) -> BrierDecomposition:
    """
    Murphy (1973) decomposition of the Brier Score into uncertainty,
    resolution, and reliability using equal-width confidence bins.

    Brier = Uncertainty - Resolution + Reliability

    Only considers predictions where confidence_available is True.
    Raises ValueError if no such predictions exist.
    """
    available = [p for p in predictions if p.confidence_available]
    if not available:
        raise ValueError("No confidence-available predictions for Brier decomposition")

    n = len(available)
    overall_correct = sum(
        1 for p in available if p.predicted_label == p.ground_truth_label
    )
    overall_accuracy = overall_correct / n

    # Equal-width bins
    reliability = 0.0
    resolution = 0.0
    for k in range(n_bins):
        lower = k / n_bins
        upper = (k + 1) / n_bins
        bin_preds = [
            p for p in available
            if (lower <= p.confidence < upper) or (k == n_bins - 1 and p.confidence == upper)
        ]
        n_k = len(bin_preds)
        if n_k == 0:
            continue
        mean_conf_k = sum(p.confidence for p in bin_preds) / n_k
        accuracy_k = sum(
            1 for p in bin_preds if p.predicted_label == p.ground_truth_label
        ) / n_k
        reliability += n_k * (mean_conf_k - accuracy_k) ** 2
        resolution += n_k * (accuracy_k - overall_accuracy) ** 2

    reliability /= n
    resolution /= n
    uncertainty = overall_accuracy * (1 - overall_accuracy)
    brier_score = uncertainty - resolution + reliability

    return BrierDecomposition(
        uncertainty=round(uncertainty, 6),
        resolution=round(resolution, 6),
        reliability=round(reliability, 6),
        brier_score=round(brier_score, 6),
    )


def _brier_binary(predictions: list[PredictionRecord]) -> float:
    """Binary Brier Score: (1/n) * sum((p_i - y_i)^2)."""
    n = len(predictions)
    total = 0.0
    for p in predictions:
        correct = 1.0 if p.predicted_label == p.ground_truth_label else 0.0
        total += (p.confidence - correct) ** 2
    return total / n


def _brier_multiclass(predictions: list[PredictionRecord]) -> float:
    """
    Multiclass Brier Score using full_probs.
    Falls back to binary for predictions without full_probs.
    """
    n = len(predictions)
    total = 0.0
    for p in predictions:
        if p.full_probs is not None:
            # Full multiclass Brier
            all_classes = set(p.full_probs.keys())
            all_classes.add(p.ground_truth_label)
            sample_score = 0.0
            for cls in all_classes:
                prob = p.full_probs.get(cls, 0.0)
                indicator = 1.0 if cls == p.ground_truth_label else 0.0
                sample_score += (prob - indicator) ** 2
            total += sample_score
        else:
            # Fallback to binary-style
            correct = 1.0 if p.predicted_label == p.ground_truth_label else 0.0
            total += (p.confidence - correct) ** 2
    return total / n
