"""FDS via AUROC: compute FDS = AUROC(confidence, is_correct)."""

from typing import Optional

from agora.eval.calibration.types import PredictionRecord


def compute_fds_auroc(
    predictions: list[PredictionRecord],
    min_errors: int = 50,
) -> "FDSAUROCResult":
    """
    Compute FDS as AUROC(confidence, is_correct).

    A high AUROC means the model's confidence scores are good at
    discriminating correct from incorrect predictions.

    Args:
        predictions: list of PredictionRecords for one vendor.
        min_errors: minimum number of errors required. If fewer,
                    flag as insufficient.

    Returns:
        FDSAUROCResult with fds (AUROC value), n_errors, and flags.

    Raises:
        ValueError: if predictions list is empty.
    """
    if not predictions:
        raise ValueError("predictions list is empty")

    available = [p for p in predictions if p.confidence_available]
    if not available:
        return FDSAUROCResult(
            fds=0.5,
            n_correct=0,
            n_errors=0,
            n_total=0,
            insufficient_errors=True,
        )

    confidences = []
    is_correct = []
    for p in available:
        confidences.append(p.confidence)
        is_correct.append(1 if p.predicted_label == p.ground_truth_label else 0)

    n_correct = sum(is_correct)
    n_errors = len(is_correct) - n_correct
    n_total = len(available)

    insufficient = n_errors < min_errors

    # Need at least one of each class for AUROC
    if n_errors == 0 or n_correct == 0:
        return FDSAUROCResult(
            fds=0.5 if n_errors == 0 else 0.5,
            n_correct=n_correct,
            n_errors=n_errors,
            n_total=n_total,
            insufficient_errors=True,
        )

    fds = _auroc(confidences, is_correct)

    return FDSAUROCResult(
        fds=round(fds, 6),
        n_correct=n_correct,
        n_errors=n_errors,
        n_total=n_total,
        insufficient_errors=insufficient,
    )


def _auroc(scores: list[float], labels: list[int]) -> float:
    """
    Compute AUROC. Uses sklearn if available, otherwise trapezoidal.
    """
    try:
        from sklearn.metrics import roc_auc_score
        return float(roc_auc_score(labels, scores))
    except ImportError:
        return _auroc_trapezoidal(scores, labels)


def _auroc_trapezoidal(scores: list[float], labels: list[int]) -> float:
    """
    Manual AUROC via the Mann-Whitney U statistic.
    Equivalent to the probability that a randomly chosen positive example
    has a higher score than a randomly chosen negative example.
    Handles ties correctly by counting them as 0.5.
    """
    n_pos = sum(labels)
    n_neg = len(labels) - n_pos

    if n_pos == 0 or n_neg == 0:
        return 0.5

    # Collect scores by class
    pos_scores = [s for s, l in zip(scores, labels) if l == 1]
    neg_scores = [s for s, l in zip(scores, labels) if l == 0]

    # Mann-Whitney U: count how often a positive has higher score than a negative
    u = 0.0
    for ps in pos_scores:
        for ns in neg_scores:
            if ps > ns:
                u += 1.0
            elif ps == ns:
                u += 0.5

    return u / (n_pos * n_neg)


class FDSAUROCResult:
    """Result from AUROC-based FDS computation."""
    __slots__ = ("fds", "n_correct", "n_errors", "n_total", "insufficient_errors")

    def __init__(
        self,
        fds: float,
        n_correct: int,
        n_errors: int,
        n_total: int,
        insufficient_errors: bool = False,
    ):
        self.fds = fds
        self.n_correct = n_correct
        self.n_errors = n_errors
        self.n_total = n_total
        self.insufficient_errors = insufficient_errors
