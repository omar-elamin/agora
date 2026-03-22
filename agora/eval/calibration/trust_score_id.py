"""
trust_score_id: new composite trust score on [0, 1] scale.

Formula:
    ece_norm  = max(0, 1 - ece / 0.20)
    mce_norm  = max(0, 1 - mce / 0.35)
    brier_norm = max(0, 1 - brier / 0.25)   # multiclass: divide brier by K/(K-1) first
    fds_norm  = max(0, (fds - 0.50) / 0.50)

    trust_score_id = 0.40 * ece_norm + 0.20 * mce_norm + 0.20 * brier_norm + 0.20 * fds_norm

Labels:
    >= 0.85  "Highly trusted"
    0.70-0.85 "Trusted"
    0.55-0.70 "Partially trusted"
    0.40-0.55 "Low trust"
    < 0.40   "Untrusted"
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TrustScoreIDResult:
    """Result of trust_score_id computation."""
    trust_score_id: float
    trust_label: str
    ece_norm: float
    mce_norm: float
    brier_norm: float
    fds_norm: float
    flags: list[str] = field(default_factory=list)


def compute_trust_score_id(
    ece: float,
    mce: float,
    brier: float,
    fds: float,
    n_classes: int = 2,
    ece_adaptive: Optional[float] = None,
    bin_stats: Optional[list] = None,
    n_incorrect: int = 0,
) -> TrustScoreIDResult:
    """
    Compute trust_score_id from calibration metrics.

    Args:
        ece: Expected Calibration Error
        mce: Maximum Calibration Error
        brier: Brier Score
        fds: FDS (AUROC-based)
        n_classes: number of classes (for multiclass Brier normalization)
        ece_adaptive: adaptive ECE value (for flag comparison)
        bin_stats: list of BinStats (for overconfident/underconfident flags)
        n_incorrect: number of incorrect predictions (for insufficient_errors flag)
    """
    ece_norm = max(0.0, 1.0 - ece / 0.20)
    mce_norm = max(0.0, 1.0 - mce / 0.35)

    # Multiclass Brier normalization: divide by K/(K-1)
    if n_classes > 2:
        brier_adjusted = brier / (n_classes / (n_classes - 1))
    else:
        brier_adjusted = brier
    brier_norm = max(0.0, 1.0 - brier_adjusted / 0.25)

    fds_norm = max(0.0, (fds - 0.50) / 0.50)

    trust_score_id = (
        0.40 * ece_norm
        + 0.20 * mce_norm
        + 0.20 * brier_norm
        + 0.20 * fds_norm
    )

    trust_score_id = round(trust_score_id, 6)
    trust_label = _trust_label(trust_score_id)

    flags = _generate_flags(
        ece=ece,
        mce=mce,
        fds=fds,
        ece_adaptive=ece_adaptive,
        bin_stats=bin_stats,
        n_incorrect=n_incorrect,
    )

    return TrustScoreIDResult(
        trust_score_id=trust_score_id,
        trust_label=trust_label,
        ece_norm=round(ece_norm, 6),
        mce_norm=round(mce_norm, 6),
        brier_norm=round(brier_norm, 6),
        fds_norm=round(fds_norm, 6),
        flags=flags,
    )


def _trust_label(score: float) -> str:
    if score >= 0.85:
        return "Highly trusted"
    elif score >= 0.70:
        return "Trusted"
    elif score >= 0.55:
        return "Partially trusted"
    elif score >= 0.40:
        return "Low trust"
    else:
        return "Untrusted"


def _generate_flags(
    ece: float,
    mce: float,
    fds: float,
    ece_adaptive: Optional[float],
    bin_stats: Optional[list],
    n_incorrect: int,
) -> list[str]:
    """Auto-generate flags based on metric values."""
    flags: list[str] = []

    # mce_high_relative_to_ece
    if ece > 0 and mce > 3 * ece:
        flags.append("mce_high_relative_to_ece")

    # fds_low
    if fds < 0.65:
        flags.append("fds_low")

    # adaptive_ece_divergence
    if ece_adaptive is not None and abs(ece - ece_adaptive) > 0.03:
        flags.append("adaptive_ece_divergence")

    # insufficient_errors
    if n_incorrect < 50:
        flags.append("insufficient_errors")

    # overconfident / underconfident from bin stats
    if bin_stats:
        n_over = 0
        n_under = 0
        n_populated = 0
        for b in bin_stats:
            if b.count > 0:
                n_populated += 1
                if b.mean_conf > b.accuracy:
                    n_over += 1
                elif b.mean_conf < b.accuracy:
                    n_under += 1
        if n_populated > 0:
            if n_over / n_populated > 0.6:
                flags.append("overconfident")
            elif n_under / n_populated > 0.6:
                flags.append("underconfident")

    return flags
