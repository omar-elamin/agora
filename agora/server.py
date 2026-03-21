"""FastAPI sidecar for running Python eval pipelines."""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, Optional

from fastapi import FastAPI
from pydantic import BaseModel

from agora.eval.sentiment_ood import run_sentiment_ood_eval

app = FastAPI(title="Agora Eval Backend", version="0.1.0")


class SentimentRequest(BaseModel):
    model_vendor: str = "baseline"
    model_endpoint: str = "majority-class"
    config: Optional[Dict[str, Any]] = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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
