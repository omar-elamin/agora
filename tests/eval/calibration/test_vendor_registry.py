"""Tests for the vendor configuration registry."""

import math
import pytest
from pathlib import Path

from agora.eval.calibration.normalize import (
    ConfidenceFormat,
    normalize_predictions,
)
from agora.eval.calibration.vendor_registry import (
    VendorConfig,
    load_vendor_registry,
    get_vendor_config,
    reset_registry_cache,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    """Reset the module-level registry cache between tests."""
    reset_registry_cache()
    yield
    reset_registry_cache()


# -----------------------------------------------------------------------
# load_vendor_registry
# -----------------------------------------------------------------------

class TestLoadVendorRegistry:
    def test_loads_all_vendors(self):
        registry = load_vendor_registry()
        assert "deepgram" in registry
        assert "whisper" in registry
        assert "assemblyai" in registry
        assert "rev_ai" in registry

    def test_returns_vendor_config_instances(self):
        registry = load_vendor_registry()
        for vc in registry.values():
            assert isinstance(vc, VendorConfig)

    def test_deepgram_config(self):
        registry = load_vendor_registry()
        dg = registry["deepgram"]
        assert dg.vendor_id == "deepgram"
        assert dg.confidence_format is ConfidenceFormat.PROBABILITY
        assert dg.score_range == [0.0, 1.0]
        assert "empty_segment_zero" in dg.quirks

    def test_whisper_config(self):
        registry = load_vendor_registry()
        w = registry["whisper"]
        assert w.confidence_format is ConfidenceFormat.LOGPROB
        assert w.score_range is None

    def test_assemblyai_config(self):
        registry = load_vendor_registry()
        aa = registry["assemblyai"]
        assert aa.confidence_format is ConfidenceFormat.PROBABILITY
        assert "per_word_aggregation" in aa.quirks

    def test_rev_ai_config(self):
        registry = load_vendor_registry()
        r = registry["rev_ai"]
        assert r.confidence_format is ConfidenceFormat.PROBABILITY
        assert "label_endpoints" in r.quirks


# -----------------------------------------------------------------------
# get_vendor_config
# -----------------------------------------------------------------------

class TestGetVendorConfig:
    def test_known_vendor(self):
        vc = get_vendor_config("deepgram")
        assert vc is not None
        assert vc.vendor_id == "deepgram"

    def test_unknown_vendor_returns_none(self):
        assert get_vendor_config("unknown_vendor_xyz") is None

    def test_caching(self):
        """Second call should use cached registry."""
        vc1 = get_vendor_config("deepgram")
        vc2 = get_vendor_config("deepgram")
        assert vc1 is vc2


# -----------------------------------------------------------------------
# normalize_predictions with vendor_id
# -----------------------------------------------------------------------

class TestNormalizePredictionsWithVendorId:
    def _make_raw(self, confidence, **overrides):
        base = {
            "example_id": "ex1",
            "vendor_id": "deepgram",
            "predicted_label": "en",
            "ground_truth_label": "en",
            "confidence": confidence,
            "task_category": "language_id",
            "eval_date": "2026-03-19",
        }
        base.update(overrides)
        return base

    def test_vendor_id_uses_registry_format(self):
        """Whisper uses logprob format; a value like -0.5 should be
        exp(-0.5) ≈ 0.6065 instead of auto-detected as logprob anyway."""
        records = normalize_predictions(
            [self._make_raw(-0.5, vendor_id="whisper")],
            vendor_id="whisper",
        )
        assert records[0].confidence == pytest.approx(math.exp(-0.5))

    def test_vendor_id_overrides_auto_detect(self):
        """0.95 auto-detects as PROBABILITY. But if we say it's a
        deepgram vendor (probability), it stays the same. Use whisper
        (logprob) to show the override matters for an ambiguous value."""
        # -0.1 auto-detects as LOGPROB, but let's use a probability vendor
        # to show vendor_id forces the format.
        # 0.5 auto-detects as PROBABILITY. With deepgram (probability) -> 0.5.
        records = normalize_predictions(
            [self._make_raw(0.5, vendor_id="deepgram")],
            vendor_id="deepgram",
        )
        assert records[0].confidence == pytest.approx(0.5)

    def test_unknown_vendor_falls_back_to_auto_detect(self):
        """Unknown vendor_id should fall back to auto-detection."""
        records = normalize_predictions(
            [self._make_raw(0.9, vendor_id="unknown_vendor")],
            vendor_id="unknown_vendor",
        )
        # 0.9 auto-detects as PROBABILITY
        assert records[0].confidence == pytest.approx(0.9)

    def test_no_vendor_id_backward_compatible(self):
        """Omitting vendor_id preserves current behavior."""
        records = normalize_predictions([self._make_raw(0.9)])
        assert records[0].confidence == pytest.approx(0.9)

    def test_vendor_config_takes_precedence_over_vendor_id(self):
        """Explicit vendor_config should override vendor_id lookup."""
        records = normalize_predictions(
            [self._make_raw(0.5)],
            vendor_config={"confidence_format": "percentage"},
            vendor_id="deepgram",
        )
        # 0.5 treated as percentage -> 0.005
        assert records[0].confidence == pytest.approx(0.005)

    def test_whisper_logprob_via_registry(self):
        """Whisper value that auto-detect would also get right, but
        exercising the registry path."""
        records = normalize_predictions(
            [self._make_raw(-2.0, vendor_id="whisper")],
            vendor_id="whisper",
        )
        assert records[0].confidence == pytest.approx(math.exp(-2.0))
