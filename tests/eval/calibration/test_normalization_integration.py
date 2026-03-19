"""
Integration tests for the full normalization → ECE → FDS → Trust Score pipeline.
"""

import pytest
from agora.eval.calibration.normalize import normalize_predictions, detect_confidence_format, ConfidenceFormat
from agora.eval.calibration.ece import compute_ece
from agora.eval.calibration.fds_probe import compute_fds
from agora.eval.calibration.trust_score import compute_trust_score
from agora.eval.calibration.types import PredictionRecord


def make_raw(example_id, vendor_id, predicted, ground_truth, confidence, task_category="asr"):
    return {
        "example_id": example_id,
        "vendor_id": vendor_id,
        "predicted_label": predicted,
        "ground_truth_label": ground_truth,
        "confidence": confidence,
        "task_category": task_category,
        "eval_date": "2026-03-19",
    }


class TestNormalizationFormats:
    def test_probability_passthrough(self):
        raw = [make_raw("e1", "deepgram", "hello", "hello", 0.95)]
        records = normalize_predictions(raw)
        assert records[0].confidence == pytest.approx(0.95)
        assert records[0].confidence_available is True

    def test_logprob_conversion(self):
        import math
        raw = [make_raw("e1", "whisper", "hello", "hello", -0.1)]
        records = normalize_predictions(raw, vendor_config={"confidence_format": "logprob"})
        assert records[0].confidence == pytest.approx(math.exp(-0.1), rel=1e-5)

    def test_percentage_string(self):
        raw = [make_raw("e1", "vendor_x", "hello", "hello", "87.5%")]
        records = normalize_predictions(raw)
        assert records[0].confidence == pytest.approx(0.875)

    def test_label_high(self):
        raw = [make_raw("e1", "vendor_y", "hello", "hello", "high")]
        records = normalize_predictions(raw)
        assert records[0].confidence == pytest.approx(0.85)

    def test_missing_confidence(self):
        raw = [make_raw("e1", "vendor_z", "hello", "hello", None)]
        records = normalize_predictions(raw)
        assert records[0].confidence == pytest.approx(0.0)
        assert records[0].confidence_available is False


class TestFullPipeline:
    def _make_vendor_records(self, vendor_id, pairs):
        """pairs: list of (example_id, predicted, ground_truth, confidence)"""
        return [
            PredictionRecord(
                example_id=eid,
                vendor_id=vendor_id,
                predicted_label=pred,
                ground_truth_label=gt,
                confidence=conf,
                full_probs=None,
                task_category="asr",
                eval_date="2026-03-19",
                confidence_available=True,
            )
            for eid, pred, gt, conf in pairs
        ]

    def test_well_calibrated_vendor(self):
        """A vendor where confidence ≈ accuracy should have low ECE."""
        records = self._make_vendor_records("good_vendor", [
            ("e1", "cat", "cat", 0.9),
            ("e2", "dog", "dog", 0.85),
            ("e3", "cat", "cat", 0.95),
            ("e4", "bird", "bird", 0.8),
            ("e5", "fish", "fish", 0.75),
            ("e6", "fish", "fish", 0.7),
            ("e7", "cat", "cat", 0.65),
            ("e8", "dog", "cat", 0.35),
            ("e9", "bird", "bird", 0.4),
            ("e10", "fish", "dog", 0.3),
        ])
        result = compute_ece(records)
        assert result.ece < 0.35  # relatively well calibrated vs overconfident

    def test_overconfident_vendor(self):
        """A vendor always predicting 0.99 confidence with 70% accuracy should have high ECE."""
        records = self._make_vendor_records("overconfident_vendor", [
            ("e1", "cat", "cat", 0.99),
            ("e2", "dog", "cat", 0.99),
            ("e3", "cat", "cat", 0.99),
            ("e4", "bird", "dog", 0.99),
            ("e5", "fish", "fish", 0.99),
            ("e6", "fish", "fish", 0.99),
            ("e7", "cat", "dog", 0.99),
            ("e8", "dog", "cat", 0.99),
            ("e9", "bird", "bird", 0.99),
            ("e10", "fish", "fish", 0.99),
        ])
        result = compute_ece(records)
        assert result.ece > 0.1  # overconfident = high ECE

    def test_fds_cross_vendor_disagreement(self):
        """FDS should detect errors flagged by cross-vendor disagreement."""
        vendor_a = self._make_vendor_records("vendor_a", [
            ("e1", "cat", "cat", 0.9),
            ("e2", "dog", "cat", 0.95),  # wrong, high confidence
            ("e3", "bird", "bird", 0.8),
        ])
        vendor_b = self._make_vendor_records("vendor_b", [
            ("e1", "cat", "cat", 0.88),
            ("e2", "cat", "cat", 0.85),  # correct
            ("e3", "bird", "bird", 0.82),
        ])
        vendor_c = self._make_vendor_records("vendor_c", [
            ("e1", "cat", "cat", 0.92),
            ("e2", "cat", "cat", 0.9),   # correct
            ("e3", "bird", "bird", 0.78),
        ])
        all_records = vendor_a + vendor_b + vendor_c
        by_vendor = {"vendor_a": vendor_a, "vendor_b": vendor_b, "vendor_c": vendor_c}
        result = compute_fds("vendor_a", by_vendor, task_category="asr")
        # e2 is vendor_a's error; b and c both disagree → should be detected
        assert result.fds_overall > 0.0

    def test_trust_score_ordering(self):
        """Higher accuracy + lower ECE vendor should have higher trust score."""
        good_records = self._make_vendor_records("good_vendor", [
            ("e1", "cat", "cat", 0.88),
            ("e2", "dog", "dog", 0.82),
            ("e3", "cat", "cat", 0.9),
            ("e4", "bird", "bird", 0.78),
            ("e5", "fish", "fish", 0.72),
        ])
        bad_records = self._make_vendor_records("bad_vendor", [
            ("e1", "dog", "cat", 0.99),
            ("e2", "cat", "dog", 0.99),
            ("e3", "bird", "cat", 0.99),
            ("e4", "fish", "dog", 0.99),
            ("e5", "cat", "fish", 0.99),
        ])
        good_cal = compute_ece(good_records)
        bad_cal = compute_ece(bad_records)
        good_ts = compute_trust_score(
            vendor_id="good_vendor", task_category="asr", eval_date="2026-03-19",
            accuracy=1.0, calibration=good_cal, fds=None
        )
        bad_ts = compute_trust_score(
            vendor_id="bad_vendor", task_category="asr", eval_date="2026-03-19",
            accuracy=0.0, calibration=bad_cal, fds=None
        )
        assert good_ts.trust_score > bad_ts.trust_score


class TestAutoDetect:
    def test_detect_logprob(self):
        assert detect_confidence_format(-0.5) == ConfidenceFormat.LOGPROB

    def test_detect_probability(self):
        assert detect_confidence_format(0.87) == ConfidenceFormat.PROBABILITY

    def test_detect_percentage_string(self):
        assert detect_confidence_format("87.5%") == ConfidenceFormat.PERCENTAGE

    def test_detect_label(self):
        assert detect_confidence_format("high") == ConfidenceFormat.LABEL

    def test_detect_none(self):
        assert detect_confidence_format(None) == ConfidenceFormat.MISSING

    def test_detect_softmax_dict(self):
        assert detect_confidence_format({"cat": 0.9, "dog": 0.1}) == ConfidenceFormat.SOFTMAX_DICT
