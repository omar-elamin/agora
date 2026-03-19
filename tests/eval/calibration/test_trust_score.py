import pytest

from agora.eval.calibration.trust_score import (
    TrustScoreWeights,
    compute_trust_score,
    _normalize_ece,
    _normalize_invisible_failure,
    _trust_score_label,
)
from agora.eval.calibration.types import CalibrationResult, FDSResult, BinStats


def _make_calibration(vendor_id="vendor_a", ece=0.05) -> CalibrationResult:
    return CalibrationResult(
        vendor_id=vendor_id,
        task_category="classification",
        eval_date="2026-03-19",
        n_total=100,
        n_bins=10,
        bins=[],
        ece=ece,
        mce=ece,
        label="Well-calibrated",
        label_color="green",
    )


def _make_fds(
    vendor_id="vendor_a",
    fds_overall=0.9,
    invisible_failure_rate=0.01,
) -> FDSResult:
    return FDSResult(
        vendor_id=vendor_id,
        task_category="classification",
        eval_date="2026-03-19",
        n_errors=10,
        n_detectable=9,
        n_high_conf_errors=5,
        n_invisible=1,
        fds_overall=fds_overall,
        fds_high_confidence=0.8,
        invisible_failure_rate=invisible_failure_rate,
        probe_details={"cross_vendor": 9},
        vendors_in_comparison=["vendor_a", "vendor_b"],
    )


class TestComputeTrustScore:
    def test_perfect_vendor(self):
        """accuracy=1.0, ECE=0, FDS=1.0, invisible=0.0 -> trust_score=100."""
        cal = _make_calibration(ece=0.0)
        fds = _make_fds(fds_overall=1.0, invisible_failure_rate=0.0)
        result = compute_trust_score(
            "vendor_a", "classification", "2026-03-19",
            accuracy=1.0, calibration=cal, fds=fds,
        )
        assert result.trust_score == 100.0

    def test_worst_vendor(self):
        """accuracy=0.5, ECE=1.0, FDS=0.0, invisible>0.1 -> low score."""
        cal = _make_calibration(ece=1.0)
        fds = _make_fds(fds_overall=0.0, invisible_failure_rate=0.15)
        result = compute_trust_score(
            "vendor_a", "classification", "2026-03-19",
            accuracy=0.5, calibration=cal, fds=fds,
        )
        # 100 * (0.4*0.5 + 0.25*0.0 + 0.20*0.0 + 0.15*0.0) = 100 * 0.2 = 20
        assert abs(result.trust_score - 20.0) < 0.1

    def test_weights_validation(self):
        """Weights not summing to 1.0 -> ValueError."""
        bad_weights = TrustScoreWeights(
            accuracy=0.5, calibration=0.5, fds=0.5, invisible_failure=0.5
        )
        cal = _make_calibration()
        with pytest.raises(ValueError, match="sum to 1.0"):
            compute_trust_score(
                "vendor_a", "classification", "2026-03-19",
                accuracy=0.9, calibration=cal, fds=None,
                weights=bad_weights,
            )

    def test_no_fds_uses_defaults(self):
        """fds=None -> neutral defaults."""
        cal = _make_calibration(ece=0.05)
        result = compute_trust_score(
            "vendor_a", "classification", "2026-03-19",
            accuracy=0.9, calibration=cal, fds=None,
        )
        # fds_overall defaults to 0.5, invisible_failure_rate to 0.0
        assert result.fds_overall == 0.5
        assert result.invisible_failure_rate == 0.0
        assert result.trust_score > 0

    def test_invalid_accuracy_raises(self):
        cal = _make_calibration()
        with pytest.raises(ValueError, match="accuracy"):
            compute_trust_score(
                "vendor_a", "classification", "2026-03-19",
                accuracy=1.5, calibration=cal, fds=None,
            )

    def test_vendor_mismatch_raises(self):
        cal = _make_calibration(vendor_id="vendor_b")
        with pytest.raises(ValueError, match="vendor_id"):
            compute_trust_score(
                "vendor_a", "classification", "2026-03-19",
                accuracy=0.9, calibration=cal, fds=None,
            )

    def test_component_breakdown_present(self):
        cal = _make_calibration(ece=0.05)
        fds = _make_fds()
        result = compute_trust_score(
            "vendor_a", "classification", "2026-03-19",
            accuracy=0.9, calibration=cal, fds=fds,
        )
        assert "accuracy_contrib" in result.component_breakdown
        assert "calibration_contrib" in result.component_breakdown
        assert "fds_contrib" in result.component_breakdown
        assert "invisible_failure_contrib" in result.component_breakdown

    def test_label_trusted(self):
        cal = _make_calibration(ece=0.0)
        fds = _make_fds(fds_overall=1.0, invisible_failure_rate=0.0)
        result = compute_trust_score(
            "vendor_a", "classification", "2026-03-19",
            accuracy=1.0, calibration=cal, fds=fds,
        )
        assert result.label == "Trusted"

    def test_label_risky(self):
        cal = _make_calibration(ece=0.5)
        fds = _make_fds(fds_overall=0.0, invisible_failure_rate=0.1)
        result = compute_trust_score(
            "vendor_a", "classification", "2026-03-19",
            accuracy=0.5, calibration=cal, fds=fds,
        )
        assert result.label == "Risky"


class TestNormalization:
    def test_normalize_ece(self):
        assert _normalize_ece(0.0) == 1.0
        assert _normalize_ece(1.0) == 0.0
        assert _normalize_ece(0.5) == 0.5

    def test_normalize_invisible_failure(self):
        assert _normalize_invisible_failure(0.0) == 1.0
        assert _normalize_invisible_failure(0.1) == 0.0
        assert _normalize_invisible_failure(0.2) == 0.0  # clamped
        assert abs(_normalize_invisible_failure(0.05) - 0.5) < 1e-9

    def test_trust_score_label(self):
        assert _trust_score_label(90) == "Trusted"
        assert _trust_score_label(75) == "Acceptable"
        assert _trust_score_label(50) == "Risky"
