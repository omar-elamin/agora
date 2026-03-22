import pytest

from agora.eval.calibration.trust_score_id import compute_trust_score_id, _trust_label


class TestTrustScoreID:
    def test_worked_example(self):
        """
        Spec worked example:
        ECE=0.04, MCE=0.12, Brier=0.08, FDS=0.81
        ece_norm = 1 - 0.04/0.20 = 0.80
        mce_norm = 1 - 0.12/0.35 ≈ 0.6571
        brier_norm = 1 - 0.08/0.25 = 0.68
        fds_norm = (0.81-0.50)/0.50 = 0.62
        trust_score_id = 0.40*0.80 + 0.20*0.6571 + 0.20*0.68 + 0.20*0.62
                       = 0.32 + 0.13143 + 0.136 + 0.124 = 0.71143
        """
        result = compute_trust_score_id(
            ece=0.04, mce=0.12, brier=0.08, fds=0.81,
        )
        assert result.trust_score_id == pytest.approx(0.711, abs=0.002)
        assert result.trust_label == "Trusted"

    def test_perfect_scores(self):
        result = compute_trust_score_id(
            ece=0.0, mce=0.0, brier=0.0, fds=1.0,
        )
        assert result.trust_score_id == pytest.approx(1.0)
        assert result.trust_label == "Highly trusted"

    def test_worst_scores(self):
        result = compute_trust_score_id(
            ece=0.30, mce=0.50, brier=0.40, fds=0.40,
        )
        assert result.trust_score_id == pytest.approx(0.0)
        assert result.trust_label == "Untrusted"

    def test_multiclass_brier_normalization(self):
        """For 4-class, brier is divided by 4/3 before normalization."""
        result = compute_trust_score_id(
            ece=0.0, mce=0.0, brier=0.20, fds=1.0, n_classes=4,
        )
        # brier_adjusted = 0.20 / (4/3) = 0.15
        # brier_norm = 1 - 0.15/0.25 = 0.40
        assert result.brier_norm == pytest.approx(0.40)

    def test_binary_brier_no_adjustment(self):
        """For binary (n_classes=2), no adjustment."""
        result = compute_trust_score_id(
            ece=0.0, mce=0.0, brier=0.10, fds=1.0, n_classes=2,
        )
        # brier_norm = 1 - 0.10/0.25 = 0.60
        assert result.brier_norm == pytest.approx(0.60)

    def test_clamping(self):
        """Normalized values should be clamped to [0, 1]."""
        result = compute_trust_score_id(
            ece=0.50, mce=1.0, brier=0.50, fds=0.30,
        )
        assert result.ece_norm == 0.0
        assert result.mce_norm == 0.0
        assert result.brier_norm == 0.0
        assert result.fds_norm == 0.0
        assert result.trust_score_id == 0.0


class TestTrustLabels:
    def test_highly_trusted(self):
        assert _trust_label(0.90) == "Highly trusted"
        assert _trust_label(0.85) == "Highly trusted"

    def test_trusted(self):
        assert _trust_label(0.80) == "Trusted"
        assert _trust_label(0.70) == "Trusted"

    def test_partially_trusted(self):
        assert _trust_label(0.60) == "Partially trusted"
        assert _trust_label(0.55) == "Partially trusted"

    def test_low_trust(self):
        assert _trust_label(0.50) == "Low trust"
        assert _trust_label(0.40) == "Low trust"

    def test_untrusted(self):
        assert _trust_label(0.39) == "Untrusted"
        assert _trust_label(0.0) == "Untrusted"


class TestFlags:
    def test_mce_high_relative_to_ece(self):
        result = compute_trust_score_id(ece=0.03, mce=0.15, brier=0.1, fds=0.8)
        assert "mce_high_relative_to_ece" in result.flags

    def test_fds_low(self):
        result = compute_trust_score_id(ece=0.03, mce=0.05, brier=0.1, fds=0.60)
        assert "fds_low" in result.flags

    def test_adaptive_ece_divergence(self):
        result = compute_trust_score_id(
            ece=0.03, mce=0.05, brier=0.1, fds=0.8, ece_adaptive=0.08,
        )
        assert "adaptive_ece_divergence" in result.flags

    def test_no_adaptive_ece_divergence_small_diff(self):
        result = compute_trust_score_id(
            ece=0.03, mce=0.05, brier=0.1, fds=0.8, ece_adaptive=0.04,
        )
        assert "adaptive_ece_divergence" not in result.flags

    def test_insufficient_errors(self):
        result = compute_trust_score_id(
            ece=0.03, mce=0.05, brier=0.1, fds=0.8, n_incorrect=30,
        )
        assert "insufficient_errors" in result.flags
