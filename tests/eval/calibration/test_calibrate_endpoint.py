"""Tests for the POST /calibrate endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from agora.server import app

client = TestClient(app)


class TestLanguageGuard:
    """LANGUAGE GUARD: lang_prob_en < 0.80 → T=1.0, LANGUAGE_SWITCH_RISK."""

    def test_low_lang_prob_returns_language_guard(self):
        resp = client.post("/calibrate", json={"lang_prob_en": 0.90})
        assert resp.status_code == 200
        data = resp.json()
        assert data["T_applied"] == 1.0
        assert data["detection_method"] == "language_guard"
        assert "LANGUAGE_SWITCH_RISK" in data["flags"]

    def test_language_guard_overrides_locale(self):
        """Language guard takes priority even when a high-T locale is provided."""
        resp = client.post("/calibrate", json={
            "speaker_locale": "ar-SA",
            "lang_prob_en": 0.79,
        })
        data = resp.json()
        assert data["T_applied"] == 1.0
        assert data["detection_method"] == "language_guard"

    def test_lang_prob_exactly_080_does_not_trigger_guard(self):
        resp = client.post("/calibrate", json={
            "speaker_locale": "en-US",
            "lang_prob_en": 0.80,
        })
        data = resp.json()
        assert data["detection_method"] != "language_guard"


class TestWerGating:
    """WER GATING: wer_estimate > wer_threshold caps T at min(routed_T, 2.0)."""

    def test_wer_gating_caps_high_t(self):
        resp = client.post("/calibrate", json={
            "speaker_locale": "ar-SA",
            "wer_estimate": 0.25,
            "wer_threshold": 0.15,
        })
        data = resp.json()
        assert data["T_applied"] == 2.0
        assert any("WER_GATED" in f for f in data["flags"])

    def test_wer_gating_flag_includes_original_t(self):
        resp = client.post("/calibrate", json={
            "speaker_locale": "hi-IN",
            "wer_estimate": 0.20,
        })
        data = resp.json()
        assert "WER_GATED (was T=6.5)" in data["flags"]

    def test_wer_below_threshold_no_gating(self):
        resp = client.post("/calibrate", json={
            "speaker_locale": "ar-SA",
            "wer_estimate": 0.10,
            "wer_threshold": 0.15,
        })
        data = resp.json()
        assert data["T_applied"] == 6.5
        assert data["flags"] == []

    def test_wer_gating_disabled(self):
        resp = client.post("/calibrate", json={
            "speaker_locale": "ar-SA",
            "wer_estimate": 0.25,
            "wer_gating": False,
        })
        data = resp.json()
        assert data["T_applied"] == 6.5
        assert data["flags"] == []

    def test_wer_gating_no_cap_when_t_already_low(self):
        """If routed T <= 2.0, WER gating doesn't change it."""
        resp = client.post("/calibrate", json={
            "speaker_locale": "en-US",
            "wer_estimate": 0.25,
        })
        data = resp.json()
        assert data["T_applied"] == 1.0
        assert not any("WER_GATED" in f for f in data["flags"])


class TestLocaleRouting:
    """Locale routing via speaker_locale parameter."""

    def test_native_en(self):
        resp = client.post("/calibrate", json={"speaker_locale": "en-US"})
        data = resp.json()
        assert data["T_applied"] == 1.0
        assert data["accent_group"] == "native_en"
        assert data["detection_method"] == "customer"

    def test_high_t_arabic(self):
        resp = client.post("/calibrate", json={"speaker_locale": "ar-SA"})
        data = resp.json()
        assert data["T_applied"] == 6.5
        assert data["accent_group"] == "high_t"

    def test_germanic(self):
        resp = client.post("/calibrate", json={"speaker_locale": "de-DE"})
        data = resp.json()
        assert data["T_applied"] == 2.0
        assert data["accent_group"] == "low_t_germanic"


class TestPhoneProxyFallback:
    """Phone proxy fallback when speaker_locale is not provided."""

    def test_phone_proxy_saudi(self):
        resp = client.post("/calibrate", json={"caller_phone": "+966501234567"})
        data = resp.json()
        assert data["T_applied"] == 6.5
        assert data["accent_group"] == "high_t"
        assert data["detection_method"] == "phone_proxy"

    def test_phone_proxy_germany(self):
        resp = client.post("/calibrate", json={"caller_phone": "+491701234567"})
        data = resp.json()
        assert data["T_applied"] == 2.0
        assert data["detection_method"] == "phone_proxy"


class TestDefaultCase:
    """Default case: no locale, no phone, no whisper_lang."""

    def test_default_returns_standard(self):
        resp = client.post("/calibrate", json={})
        data = resp.json()
        assert data["T_applied"] == 4.0
        assert data["accent_group"] == "standard"
        assert data["detection_method"] == "default"
        assert data["flags"] == []

    def test_response_shape(self):
        resp = client.post("/calibrate", json={})
        data = resp.json()
        assert set(data.keys()) == {"T_applied", "accent_group", "detection_method", "calibration_mode", "flags", "human_review"}


class TestAdaptiveTemperatureEndpoint:
    """Adaptive temperature routing via CALIBRATION_MODE env var."""

    def test_adaptive_high_conf_returns_t2(self, monkeypatch):
        monkeypatch.setenv("CALIBRATION_MODE", "adaptive")
        resp = client.post("/calibrate", json={"pseudo_conf": 0.95})
        data = resp.json()
        assert data["T_applied"] == 2.0
        assert data["calibration_mode"] == "adaptive"
        assert "ADAPTIVE_TEMP" in data["flags"]

    def test_adaptive_low_conf_returns_t4(self, monkeypatch):
        monkeypatch.setenv("CALIBRATION_MODE", "adaptive")
        resp = client.post("/calibrate", json={"pseudo_conf": 0.80})
        data = resp.json()
        assert data["T_applied"] == 4.0
        assert "ADAPTIVE_TEMP" in data["flags"]

    def test_fixed_mode_ignores_pseudo_conf(self, monkeypatch):
        monkeypatch.setenv("CALIBRATION_MODE", "fixed")
        resp = client.post("/calibrate", json={"pseudo_conf": 0.95})
        data = resp.json()
        # Fixed mode: pseudo_conf is ignored, falls through to locale routing default
        assert data["calibration_mode"] == "fixed"
        assert "ADAPTIVE_TEMP" not in data["flags"]

    def test_adaptive_without_pseudo_conf_falls_through(self, monkeypatch):
        monkeypatch.setenv("CALIBRATION_MODE", "adaptive")
        resp = client.post("/calibrate", json={"speaker_locale": "ar-SA"})
        data = resp.json()
        # No pseudo_conf → locale routing applies
        assert data["T_applied"] == 6.5
        assert "ADAPTIVE_TEMP" not in data["flags"]

    def test_adaptive_with_wer_gating(self, monkeypatch):
        """Adaptive T=4.0 gets WER-gated down to 2.0 when WER exceeds threshold."""
        monkeypatch.setenv("CALIBRATION_MODE", "adaptive")
        resp = client.post("/calibrate", json={
            "pseudo_conf": 0.80,
            "wer_estimate": 0.25,
        })
        data = resp.json()
        assert data["T_applied"] == 2.0
        assert "ADAPTIVE_TEMP" in data["flags"]
        assert any("WER_GATED" in f for f in data["flags"])

    def test_adaptive_t2_not_wer_gated(self, monkeypatch):
        """Adaptive T=2.0 is not further capped by WER gating."""
        monkeypatch.setenv("CALIBRATION_MODE", "adaptive")
        resp = client.post("/calibrate", json={
            "pseudo_conf": 0.95,
            "wer_estimate": 0.25,
        })
        data = resp.json()
        assert data["T_applied"] == 2.0
        assert "ADAPTIVE_TEMP" in data["flags"]
        assert not any("WER_GATED" in f for f in data["flags"])


class TestStealthFailDetection:
    """STEALTH FAIL DETECTION: Japanese stealth fail signals flag for human review."""

    def test_dg_overconfident_flags_stealth_fail(self):
        resp = client.post("/calibrate", json={"dg_confidence": 0.95})
        data = resp.json()
        assert "DG_OVERCONFIDENT" in data["flags"]
        assert "STEALTH_FAIL_SUSPECT" in data["flags"]
        assert data["human_review"] is True

    def test_low_lang_prob_flags_stealth_fail(self):
        resp = client.post("/calibrate", json={"lang_prob_en": 0.20})
        data = resp.json()
        assert "LOW_LANG_PROB_EN" in data["flags"]
        assert "STEALTH_FAIL_SUSPECT" in data["flags"]
        assert data["human_review"] is True

    def test_both_signals_flags_both(self):
        resp = client.post("/calibrate", json={
            "dg_confidence": 0.95,
            "lang_prob_en": 0.20,
        })
        data = resp.json()
        assert "DG_OVERCONFIDENT" in data["flags"]
        assert "LOW_LANG_PROB_EN" in data["flags"]
        assert "STEALTH_FAIL_SUSPECT" in data["flags"]

    def test_dg_below_threshold_no_flag(self):
        resp = client.post("/calibrate", json={"dg_confidence": 0.90})
        data = resp.json()
        assert "STEALTH_FAIL_SUSPECT" not in data["flags"]

    def test_lang_prob_above_threshold_no_flag(self):
        resp = client.post("/calibrate", json={"lang_prob_en": 0.90})
        data = resp.json()
        assert "STEALTH_FAIL_SUSPECT" not in data["flags"]

    def test_stealth_flag_does_not_override_routing(self):
        resp = client.post("/calibrate", json={
            "dg_confidence": 0.95,
            "speaker_locale": "ar-SA",
        })
        data = resp.json()
        assert data["T_applied"] == 6.5
        assert "STEALTH_FAIL_SUSPECT" in data["flags"]

    def test_human_review_false_when_no_stealth(self):
        resp = client.post("/calibrate", json={})
        data = resp.json()
        assert data["human_review"] is False

    def test_language_guard_includes_human_review(self):
        resp = client.post("/calibrate", json={"lang_prob_en": 0.90})
        data = resp.json()
        assert "human_review" in data
