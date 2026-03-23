"""FastAPI sidecar for running Python eval pipelines."""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, Optional

from fastapi import FastAPI
from pydantic import BaseModel

from agora.eval.calibration.speaker_locale import route_speaker_locale
from agora.eval.sentiment_ood import run_sentiment_ood_eval

app = FastAPI(title="Agora Eval Backend", version="0.1.0")


class CalibrateRequest(BaseModel):
    speaker_locale: Optional[str] = None
    caller_phone: Optional[str] = None
    whisper_lang: Optional[str] = None
    lang_prob_en: Optional[float] = None
    wer_estimate: Optional[float] = None
    wer_threshold: float = 0.15
    wer_gating: bool = True


class SentimentRequest(BaseModel):
    model_vendor: str = "baseline"
    model_endpoint: str = "majority-class"
    config: Optional[Dict[str, Any]] = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/calibrate")
def calibrate(req: CalibrateRequest) -> dict:
    flags: list[str] = []

    # LANGUAGE GUARD — highest priority
    if req.lang_prob_en is not None and req.lang_prob_en < 0.80:
        return {
            "T_applied": 1.0,
            "accent_group": "unknown",
            "detection_method": "language_guard",
            "flags": ["LANGUAGE_SWITCH_RISK"],
        }

    # Route via speaker_locale (with phone proxy / whisper_lang fallbacks)
    routed = route_speaker_locale(
        speaker_locale=req.speaker_locale,
        caller_phone=req.caller_phone,
        whisper_lang=req.whisper_lang,
    )

    t_applied: float = routed["optimal_T"]
    accent_group: str = routed["t_class"]
    detection_method: str = routed["locale_source"]

    # WER GATING
    if req.wer_gating and req.wer_estimate is not None and req.wer_estimate > req.wer_threshold:
        capped = min(t_applied, 2.0)
        if capped < t_applied:
            flags.append(f"WER_GATED (was T={t_applied})")
            t_applied = capped

    return {
        "T_applied": t_applied,
        "accent_group": accent_group,
        "detection_method": detection_method,
        "flags": flags,
    }


def _majority_class_model_fn(texts: list[str]) -> list[int]:
    """Baseline: always predict the most common label from training data.

    We don't have training labels at inference time, so we use a fixed
    majority class (0 = positive) as a stand-in.  This gives a
    non-trivial but weak baseline for calibration comparisons.
    """
    return [0] * len(texts)


@app.post("/eval/sentiment")
def eval_sentiment(req: SentimentRequest) -> dict:
    result = run_sentiment_ood_eval(
        model_fn=_majority_class_model_fn,
        config=req.config if req.config else None,
    )
    result["model"] = {
        "vendor": req.model_vendor,
        "endpoint": req.model_endpoint,
    }
    result["source"] = "eval_backend"
    return result
