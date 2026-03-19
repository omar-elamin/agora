"""Tests for confidence score normalization layer."""

import math
import pytest

from agora.eval.calibration.normalize import (
    ConfidenceFormat,
    RawConfidence,
    detect_confidence_format,
    normalize_confidence,
    normalize_predictions,
)


# -----------------------------------------------------------------------
# normalize_confidence — PROBABILITY
# -----------------------------------------------------------------------

class TestNormalizeProbability:
    def test_valid_probability(self):
        score, avail = normalize_confidence(
            RawConfidence(value=0.73, format=ConfidenceFormat.PROBABILITY)
        )
        assert score == pytest.approx(0.73)
        assert avail is True

    def test_boundary_zero(self):
        score, _ = normalize_confidence(
            RawConfidence(value=0.0, format=ConfidenceFormat.PROBABILITY)
        )
        assert score == 0.0

    def test_boundary_one(self):
        score, _ = normalize_confidence(
            RawConfidence(value=1.0, format=ConfidenceFormat.PROBABILITY)
        )
        assert score == 1.0

    def test_out_of_range_raises(self):
        with pytest.raises(ValueError, match="outside"):
            normalize_confidence(
                RawConfidence(value=1.5, format=ConfidenceFormat.PROBABILITY)
            )

    def test_negative_raises(self):
        with pytest.raises(ValueError, match="outside"):
            normalize_confidence(
                RawConfidence(value=-0.1, format=ConfidenceFormat.PROBABILITY)
            )

    def test_nan_raises(self):
        with pytest.raises(ValueError, match="finite"):
            normalize_confidence(
                RawConfidence(value=float("nan"), format=ConfidenceFormat.PROBABILITY)
            )

    def test_inf_raises(self):
        with pytest.raises(ValueError, match="finite"):
            normalize_confidence(
                RawConfidence(value=float("inf"), format=ConfidenceFormat.PROBABILITY)
            )


# -----------------------------------------------------------------------
# normalize_confidence — LOGPROB
# -----------------------------------------------------------------------

class TestNormalizeLogprob:
    def test_logprob_conversion(self):
        score, avail = normalize_confidence(
            RawConfidence(value=-0.5, format=ConfidenceFormat.LOGPROB)
        )
        assert score == pytest.approx(math.exp(-0.5))
        assert avail is True

    def test_logprob_zero(self):
        score, _ = normalize_confidence(
            RawConfidence(value=0.0, format=ConfidenceFormat.LOGPROB)
        )
        assert score == pytest.approx(1.0)

    def test_logprob_very_negative(self):
        score, _ = normalize_confidence(
            RawConfidence(value=-100.0, format=ConfidenceFormat.LOGPROB)
        )
        assert score == pytest.approx(0.0, abs=1e-30)

    def test_positive_logprob_raises(self):
        with pytest.raises(ValueError, match="must be <= 0"):
            normalize_confidence(
                RawConfidence(value=0.5, format=ConfidenceFormat.LOGPROB)
            )


# -----------------------------------------------------------------------
# normalize_confidence — PERCENTAGE
# -----------------------------------------------------------------------

class TestNormalizePercentage:
    def test_float_percentage(self):
        score, avail = normalize_confidence(
            RawConfidence(value=95.0, format=ConfidenceFormat.PERCENTAGE)
        )
        assert score == pytest.approx(0.95)
        assert avail is True

    def test_string_with_percent_sign(self):
        score, _ = normalize_confidence(
            RawConfidence(value="85%", format=ConfidenceFormat.PERCENTAGE)
        )
        assert score == pytest.approx(0.85)

    def test_string_without_percent_sign(self):
        score, _ = normalize_confidence(
            RawConfidence(value="42", format=ConfidenceFormat.PERCENTAGE)
        )
        assert score == pytest.approx(0.42)

    def test_percentage_clamped_above_100(self):
        score, _ = normalize_confidence(
            RawConfidence(value=150.0, format=ConfidenceFormat.PERCENTAGE)
        )
        assert score == 1.0


# -----------------------------------------------------------------------
# normalize_confidence — LABEL
# -----------------------------------------------------------------------

class TestNormalizeLabel:
    def test_high(self):
        score, avail = normalize_confidence(
            RawConfidence(value="high", format=ConfidenceFormat.LABEL)
        )
        assert score == 0.85
        assert avail is True

    def test_medium_case_insensitive(self):
        score, _ = normalize_confidence(
            RawConfidence(value="MEDIUM", format=ConfidenceFormat.LABEL)
        )
        assert score == 0.55

    def test_low(self):
        score, _ = normalize_confidence(
            RawConfidence(value="Low", format=ConfidenceFormat.LABEL)
        )
        assert score == 0.25

    def test_unknown_label_raises(self):
        with pytest.raises(ValueError, match="Unknown confidence label"):
            normalize_confidence(
                RawConfidence(value="very_high", format=ConfidenceFormat.LABEL)
            )

    def test_non_string_raises(self):
        with pytest.raises(ValueError, match="requires a string"):
            normalize_confidence(
                RawConfidence(value=0.5, format=ConfidenceFormat.LABEL)
            )


# -----------------------------------------------------------------------
# normalize_confidence — SOFTMAX_DICT
# -----------------------------------------------------------------------

class TestNormalizeSoftmaxDict:
    def test_takes_max(self):
        score, avail = normalize_confidence(
            RawConfidence(
                value={"en": 0.7, "fr": 0.2, "de": 0.1},
                format=ConfidenceFormat.SOFTMAX_DICT,
            )
        )
        assert score == pytest.approx(0.7)
        assert avail is True

    def test_empty_dict_raises(self):
        with pytest.raises(ValueError, match="non-empty dict"):
            normalize_confidence(
                RawConfidence(value={}, format=ConfidenceFormat.SOFTMAX_DICT)
            )

    def test_non_dict_raises(self):
        with pytest.raises(ValueError, match="non-empty dict"):
            normalize_confidence(
                RawConfidence(value="not_a_dict", format=ConfidenceFormat.SOFTMAX_DICT)
            )


# -----------------------------------------------------------------------
# normalize_confidence — MISSING
# -----------------------------------------------------------------------

class TestNormalizeMissing:
    def test_missing(self):
        score, avail = normalize_confidence(
            RawConfidence(value=None, format=ConfidenceFormat.MISSING)
        )
        assert score == 0.0
        assert avail is False


# -----------------------------------------------------------------------
# detect_confidence_format
# -----------------------------------------------------------------------

class TestDetectFormat:
    def test_none_is_missing(self):
        assert detect_confidence_format(None) is ConfidenceFormat.MISSING

    def test_float_probability(self):
        assert detect_confidence_format(0.85) is ConfidenceFormat.PROBABILITY

    def test_float_zero(self):
        assert detect_confidence_format(0.0) is ConfidenceFormat.PROBABILITY

    def test_float_one(self):
        assert detect_confidence_format(1.0) is ConfidenceFormat.PROBABILITY

    def test_negative_is_logprob(self):
        assert detect_confidence_format(-2.3) is ConfidenceFormat.LOGPROB

    def test_float_above_one_is_percentage(self):
        assert detect_confidence_format(95.0) is ConfidenceFormat.PERCENTAGE

    def test_string_percent_sign(self):
        assert detect_confidence_format("88%") is ConfidenceFormat.PERCENTAGE

    def test_string_label_high(self):
        assert detect_confidence_format("high") is ConfidenceFormat.LABEL

    def test_string_label_case_insensitive(self):
        assert detect_confidence_format("LOW") is ConfidenceFormat.LABEL

    def test_dict_is_softmax(self):
        assert detect_confidence_format({"a": 0.5}) is ConfidenceFormat.SOFTMAX_DICT

    def test_nan_is_missing(self):
        assert detect_confidence_format(float("nan")) is ConfidenceFormat.MISSING

    def test_inf_is_missing(self):
        assert detect_confidence_format(float("inf")) is ConfidenceFormat.MISSING

    def test_unparseable_string_is_missing(self):
        assert detect_confidence_format("gibberish") is ConfidenceFormat.MISSING

    def test_int_probability(self):
        assert detect_confidence_format(1) is ConfidenceFormat.PROBABILITY

    def test_int_percentage(self):
        assert detect_confidence_format(95) is ConfidenceFormat.PERCENTAGE


# -----------------------------------------------------------------------
# normalize_predictions — full flow
# -----------------------------------------------------------------------

class TestNormalizePredictions:
    def _make_raw(self, confidence, **overrides):
        base = {
            "example_id": "ex1",
            "vendor_id": "v1",
            "predicted_label": "en",
            "ground_truth_label": "en",
            "confidence": confidence,
            "task_category": "language_id",
            "eval_date": "2026-03-19",
        }
        base.update(overrides)
        return base

    def test_auto_detect_probability(self):
        records = normalize_predictions([self._make_raw(0.9)])
        assert len(records) == 1
        assert records[0].confidence == pytest.approx(0.9)
        assert records[0].confidence_available is True

    def test_auto_detect_percentage(self):
        records = normalize_predictions([self._make_raw("75%")])
        assert records[0].confidence == pytest.approx(0.75)

    def test_auto_detect_missing(self):
        records = normalize_predictions([self._make_raw(None)])
        assert records[0].confidence == 0.0
        assert records[0].confidence_available is False

    def test_forced_format_override(self):
        # Force a value that auto-detect would call PROBABILITY to be
        # treated as PERCENTAGE
        records = normalize_predictions(
            [self._make_raw(0.5)],
            vendor_config={"confidence_format": "percentage"},
        )
        assert records[0].confidence == pytest.approx(0.005)

    def test_multiple_predictions(self):
        raws = [
            self._make_raw(0.8, example_id="a"),
            self._make_raw("90%", example_id="b"),
            self._make_raw("high", example_id="c"),
        ]
        records = normalize_predictions(raws)
        assert len(records) == 3
        assert records[0].confidence == pytest.approx(0.8)
        assert records[1].confidence == pytest.approx(0.9)
        assert records[2].confidence == pytest.approx(0.85)

    def test_preserves_metadata(self):
        raw = self._make_raw(0.5, model_version="v2.1", full_probs={"en": 0.5, "fr": 0.5})
        records = normalize_predictions([raw])
        assert records[0].model_version == "v2.1"
        assert records[0].full_probs == {"en": 0.5, "fr": 0.5}
        assert records[0].vendor_id == "v1"
        assert records[0].task_category == "language_id"

    def test_forced_format_enum_object(self):
        records = normalize_predictions(
            [self._make_raw(-1.0)],
            vendor_config={"confidence_format": ConfidenceFormat.LOGPROB},
        )
        assert records[0].confidence == pytest.approx(math.exp(-1.0))
