from dataclasses import dataclass
from typing import Optional

from agora.eval.calibration.types import (
    CalibrationResult,
    FDSResult,
    TrustScoreResult,
)


@dataclass
class TrustScoreWeights:
    """
    Weights for Trust Score components. Must sum to 1.0.
    """
    accuracy: float = 0.40
    calibration: float = 0.25
    fds: float = 0.20
    invisible_failure: float = 0.15

    def validate(self) -> None:
        total = self.accuracy + self.calibration + self.fds + self.invisible_failure
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"Weights must sum to 1.0, got {total}")


def compute_trust_score(
    vendor_id: str,
    task_category: str,
    eval_date: str,
    accuracy: float,
    calibration: CalibrationResult,
    fds: Optional[FDSResult],
    weights: Optional[TrustScoreWeights] = None,
) -> TrustScoreResult:
    """
    Compute composite Trust Score (0-100) for a vendor.

    Raises:
        ValueError: if accuracy outside [0.0, 1.0]
        ValueError: if calibration.vendor_id != vendor_id
    """
    if accuracy < 0.0 or accuracy > 1.0:
        raise ValueError(f"accuracy must be in [0.0, 1.0], got {accuracy}")

    if calibration.vendor_id != vendor_id:
        raise ValueError(
            f"calibration.vendor_id '{calibration.vendor_id}' != vendor_id '{vendor_id}'"
        )

    if weights is None:
        weights = TrustScoreWeights()
    weights.validate()

    fds_overall = fds.fds_overall if fds else 0.5
    invisible_rate = fds.invisible_failure_rate if fds else 0.0

    acc_norm = _normalize_accuracy(accuracy)
    cal_norm = _normalize_ece(calibration.ece)
    fds_norm = _normalize_fds(fds_overall)
    inv_norm = _normalize_invisible_failure(invisible_rate)

    acc_contrib = weights.accuracy * acc_norm * 100
    cal_contrib = weights.calibration * cal_norm * 100
    fds_contrib = weights.fds * fds_norm * 100
    inv_contrib = weights.invisible_failure * inv_norm * 100

    trust_score = acc_contrib + cal_contrib + fds_contrib + inv_contrib

    label = _trust_score_label(trust_score)

    return TrustScoreResult(
        vendor_id=vendor_id,
        task_category=task_category,
        eval_date=eval_date,
        accuracy=accuracy,
        ece=calibration.ece,
        fds_overall=fds_overall,
        invisible_failure_rate=invisible_rate,
        trust_score=round(trust_score, 1),
        component_breakdown={
            "accuracy_contrib": round(acc_contrib, 1),
            "calibration_contrib": round(cal_contrib, 1),
            "fds_contrib": round(fds_contrib, 1),
            "invisible_failure_contrib": round(inv_contrib, 1),
        },
        label=label,
    )


def _normalize_accuracy(accuracy: float) -> float:
    """Accuracy is already [0,1], pass through."""
    return accuracy


def _normalize_ece(ece: float) -> float:
    """Convert ECE to 0-1 contribution (higher = better)."""
    return max(0.0, min(1.0, 1.0 - ece))


def _normalize_fds(fds_overall: float) -> float:
    """FDS is already [0,1], pass through."""
    return fds_overall


def _normalize_invisible_failure(invisible_failure_rate: float) -> float:
    """
    Convert invisible failure rate to 0-1 contribution.
    Formula: (1 - invisible_failure_rate * 10), clamped to [0, 1].
    """
    return max(0.0, min(1.0, 1.0 - invisible_failure_rate * 10))


def _trust_score_label(score: float) -> str:
    """
    score >= 85 -> "Trusted"
    score 65-85 -> "Acceptable"
    score < 65 -> "Risky"
    """
    if score >= 85:
        return "Trusted"
    elif score >= 65:
        return "Acceptable"
    else:
        return "Risky"
