"""
Confidence score normalization layer for the calibration pipeline.

Vendors report confidence in different formats (probabilities, logprobs,
percentages, labels, softmax dicts). This module normalizes them all to
float [0, 1] before they enter the calibration pipeline.
"""

import math
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional, Union

from agora.eval.calibration.types import PredictionRecord


class ConfidenceFormat(Enum):
    """Supported confidence score formats from vendor APIs."""
    PROBABILITY = "probability"
    LOGPROB = "logprob"
    PERCENTAGE = "percentage"
    LABEL = "label"
    SOFTMAX_DICT = "softmax_dict"
    MISSING = "missing"


_LABEL_MAP = {
    "high": 0.85,
    "medium": 0.55,
    "low": 0.25,
}


@dataclass
class RawConfidence:
    """Raw confidence value as reported by a vendor."""
    value: Optional[Union[str, float, dict]]
    format: ConfidenceFormat


def normalize_confidence(raw: RawConfidence) -> tuple[float, bool]:
    """
    Normalize a raw confidence value to a float in [0, 1].

    Returns (normalized_score, is_available).
    """
    if raw.format is ConfidenceFormat.MISSING:
        return (0.0, False)

    if raw.format is ConfidenceFormat.PROBABILITY:
        v = _to_float(raw.value, "PROBABILITY")
        _check_finite(v, "PROBABILITY")
        if not (0.0 <= v <= 1.0):
            raise ValueError(
                f"PROBABILITY value {v} is outside [0, 1]"
            )
        return (_clamp(v), True)

    if raw.format is ConfidenceFormat.LOGPROB:
        v = _to_float(raw.value, "LOGPROB")
        _check_finite(v, "LOGPROB")
        if v > 0:
            raise ValueError(f"LOGPROB value {v} must be <= 0")
        return (_clamp(math.exp(v)), True)

    if raw.format is ConfidenceFormat.PERCENTAGE:
        v = _parse_percentage(raw.value)
        _check_finite(v, "PERCENTAGE")
        return (_clamp(v / 100.0), True)

    if raw.format is ConfidenceFormat.LABEL:
        if not isinstance(raw.value, str):
            raise ValueError(
                f"LABEL format requires a string, got {type(raw.value).__name__}"
            )
        key = raw.value.strip().lower()
        if key not in _LABEL_MAP:
            raise ValueError(
                f"Unknown confidence label '{raw.value}'. "
                f"Expected one of: {', '.join(_LABEL_MAP)}"
            )
        return (_LABEL_MAP[key], True)

    if raw.format is ConfidenceFormat.SOFTMAX_DICT:
        if not isinstance(raw.value, dict) or not raw.value:
            raise ValueError(
                "SOFTMAX_DICT format requires a non-empty dict"
            )
        values = []
        for k, v in raw.value.items():
            fv = _to_float(v, f"SOFTMAX_DICT[{k}]")
            _check_finite(fv, f"SOFTMAX_DICT[{k}]")
            values.append(fv)
        return (_clamp(max(values)), True)

    raise ValueError(f"Unsupported format: {raw.format}")


def detect_confidence_format(raw_value: Any) -> ConfidenceFormat:
    """
    Auto-detect the confidence format from a raw value.
    """
    if raw_value is None:
        return ConfidenceFormat.MISSING

    if isinstance(raw_value, dict):
        return ConfidenceFormat.SOFTMAX_DICT

    if isinstance(raw_value, str):
        stripped = raw_value.strip()
        if stripped.lower() in _LABEL_MAP:
            return ConfidenceFormat.LABEL
        if stripped.endswith("%"):
            return ConfidenceFormat.PERCENTAGE
        # Try parsing as a number
        try:
            fval = float(stripped)
            return _classify_numeric(fval)
        except (ValueError, OverflowError):
            pass
        return ConfidenceFormat.MISSING

    if isinstance(raw_value, (int, float)):
        if math.isnan(raw_value) or math.isinf(raw_value):
            return ConfidenceFormat.MISSING
        return _classify_numeric(float(raw_value))

    return ConfidenceFormat.MISSING


def normalize_predictions(
    raw_predictions: list[dict],
    vendor_config: Optional[dict] = None,
    vendor_id: Optional[str] = None,
) -> list[PredictionRecord]:
    """
    Convert raw API response dicts into PredictionRecords with normalized
    confidence scores.

    Each dict in raw_predictions must have keys matching PredictionRecord
    fields. The 'confidence' key holds the raw confidence value.

    vendor_config can specify:
      - "confidence_format": override auto-detection with a ConfidenceFormat value name

    vendor_id: if provided, look up the vendor registry for the known
    confidence format. Falls back to auto-detect if vendor_id is not found.
    Explicit vendor_config takes precedence over vendor_id registry lookup.
    """
    forced_format = None
    if vendor_config and "confidence_format" in vendor_config:
        fmt_name = vendor_config["confidence_format"]
        if isinstance(fmt_name, ConfidenceFormat):
            forced_format = fmt_name
        else:
            forced_format = ConfidenceFormat(fmt_name)
    elif vendor_id is not None:
        from agora.eval.calibration.vendor_registry import get_vendor_config
        vc = get_vendor_config(vendor_id)
        if vc is not None:
            forced_format = vc.confidence_format

    records: list[PredictionRecord] = []
    for entry in raw_predictions:
        raw_conf = entry.get("confidence")

        if forced_format is not None:
            fmt = forced_format
        else:
            fmt = detect_confidence_format(raw_conf)

        raw = RawConfidence(value=raw_conf, format=fmt)
        score, available = normalize_confidence(raw)

        records.append(PredictionRecord(
            example_id=entry["example_id"],
            vendor_id=entry["vendor_id"],
            predicted_label=entry["predicted_label"],
            ground_truth_label=entry["ground_truth_label"],
            confidence=score,
            full_probs=entry.get("full_probs"),
            task_category=entry["task_category"],
            eval_date=entry["eval_date"],
            model_version=entry.get("model_version"),
            confidence_available=available,
        ))

    return records


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def _to_float(value: Any, context: str) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except (ValueError, OverflowError):
            raise ValueError(
                f"Cannot parse {context} value '{value}' as float"
            )
    raise ValueError(
        f"{context} requires a numeric value, got {type(value).__name__}"
    )


def _check_finite(v: float, context: str) -> None:
    if math.isnan(v) or math.isinf(v):
        raise ValueError(f"{context} value must be finite, got {v}")


def _parse_percentage(value: Any) -> float:
    if isinstance(value, str):
        stripped = value.strip().rstrip("%").strip()
        try:
            return float(stripped)
        except (ValueError, OverflowError):
            raise ValueError(
                f"Cannot parse PERCENTAGE value '{value}' as float"
            )
    return _to_float(value, "PERCENTAGE")


def _classify_numeric(v: float) -> ConfidenceFormat:
    if v < 0:
        return ConfidenceFormat.LOGPROB
    if v <= 1.0:
        return ConfidenceFormat.PROBABILITY
    if v <= 100.0:
        return ConfidenceFormat.PERCENTAGE
    return ConfidenceFormat.PERCENTAGE
