"""Loader for the FiQA Sentiment Classification dataset (financial domain)."""

from __future__ import annotations

import warnings
from collections import Counter
from typing import Any

from datasets import load_dataset

LABEL_MAP: dict[str, int] = {"positive": 0, "negative": 1, "neutral": 2}
INT_TO_LABEL: dict[int, str] = {v: k for k, v in LABEL_MAP.items()}

EXPECTED_TEXT_FIELD = "sentence"
EXPECTED_SCORE_FIELD = "score"


def score_to_label(score: float) -> str:
    """Map a continuous sentiment score to a discrete label string."""
    if score > 0.0:
        return "positive"
    elif score < 0.0:
        return "negative"
    else:
        return "neutral"


def _validate_schema(ds: Any) -> None:
    """Assert that the dataset contains the expected fields with correct types."""
    columns = ds.column_names
    if EXPECTED_TEXT_FIELD not in columns:
        raise ValueError(
            f"Dataset missing expected text field '{EXPECTED_TEXT_FIELD}'. "
            f"Available columns: {columns}"
        )
    if EXPECTED_SCORE_FIELD not in columns:
        raise ValueError(
            f"Dataset missing expected score field '{EXPECTED_SCORE_FIELD}'. "
            f"Available columns: {columns}"
        )
    # Verify score is numeric by checking the first example
    if len(ds) > 0:
        sample_score = ds[0][EXPECTED_SCORE_FIELD]
        if not isinstance(sample_score, (int, float)):
            raise TypeError(
                f"Score field must be numeric, got {type(sample_score).__name__}"
            )


def load_fiqa_sentiment(
    split: str = "train",
    cache_dir: str | None = None,
) -> tuple[list[str], list[int], dict]:
    """Load FiQA sentiment examples and return (texts, labels, metadata).

    Parameters
    ----------
    split : str
        HuggingFace split name (default ``"train"``).
    cache_dir : str | None
        Optional cache directory for ``datasets.load_dataset``.

    Returns
    -------
    tuple[list[str], list[int], dict]
        A triple of: raw text strings, integer labels, and metadata dict.
        Metadata includes ``n``, ``split``, ``class_counts``, ``class_ratios``,
        ``imbalance_ratio``, ``imbalance_flag``, and ``raw_scores``.
    """
    ds = load_dataset(
        "TheFinAI/fiqa-sentiment-classification",
        split=split,
        cache_dir=cache_dir,
    )

    _validate_schema(ds)

    texts: list[str] = []
    labels: list[int] = []
    raw_scores: list[float] = []

    for example in ds:
        texts.append(example[EXPECTED_TEXT_FIELD])
        score = float(example[EXPECTED_SCORE_FIELD])
        raw_scores.append(score)
        labels.append(LABEL_MAP[score_to_label(score)])

    n = len(texts)
    class_counts = dict(Counter(labels))
    class_ratios = {k: v / n for k, v in class_counts.items()} if n > 0 else {}

    counts_nonzero = [v for v in class_counts.values() if v > 0]
    if len(counts_nonzero) >= 2:
        imbalance_ratio = max(counts_nonzero) / min(counts_nonzero)
    else:
        imbalance_ratio = float("inf") if counts_nonzero else 0.0
    imbalance_flag = imbalance_ratio > 3.0

    if imbalance_flag:
        warnings.warn(
            f"[fiqa-sentiment] Class imbalance detected (ratio {imbalance_ratio:.1f}:1) "
            f"in split='{split}'. Counts: {class_counts}",
            stacklevel=2,
        )

    metadata = {
        "n": n,
        "split": split,
        "class_counts": class_counts,
        "class_ratios": class_ratios,
        "imbalance_ratio": imbalance_ratio,
        "imbalance_flag": imbalance_flag,
        "raw_scores": raw_scores,
    }

    return texts, labels, metadata
