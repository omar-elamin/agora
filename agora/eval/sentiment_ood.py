"""Sentiment OOD robustness evaluation using DynaSent R1 (ID) → R2 (OOD)."""

from __future__ import annotations

from typing import Callable

from agora.loaders.dynasent import load_dynasent


def _accuracy(predictions: list[int], labels: list[int]) -> float:
    if len(labels) == 0:
        return 0.0
    return sum(p == g for p, g in zip(predictions, labels)) / len(labels)


def run_sentiment_ood_eval(
    model_fn: Callable[[list[str]], list[int]],
    config: dict | None = None,
) -> dict:
    """Run sentiment OOD evaluation.

    Parameters
    ----------
    model_fn : callable
        Takes a list of text strings, returns a list of integer labels
        (0=positive, 1=negative, 2=neutral).
    config : dict | None
        Optional overrides. Supported keys:
        - ``label_filter``: ``"strict"`` (default) or ``"ambiguity-inclusive"``.

    Returns
    -------
    dict
        Evaluation results including ID/OOD accuracy, degradation delta,
        and degradation tier.
    """
    cfg = config or {}
    label_filter = cfg.get("label_filter", "strict")

    id_texts, id_labels = load_dynasent("dynasent-r1", split="test", label_filter=label_filter)
    ood_texts, ood_labels = load_dynasent("dynasent-r2", split="test", label_filter=label_filter)

    id_preds = model_fn(id_texts)
    ood_preds = model_fn(ood_texts)

    id_acc = _accuracy(id_preds, id_labels)
    ood_acc = _accuracy(ood_preds, ood_labels)
    delta = id_acc - ood_acc

    if delta < 0.05:
        tier = "robust"
    elif delta <= 0.10:
        tier = "moderate"
    else:
        tier = "significant"

    return {
        "task": "sentiment_ood",
        "id_accuracy": round(id_acc, 4),
        "ood_accuracy": round(ood_acc, 4),
        "degradation_delta": round(delta, 4),
        "degradation_tier": tier,
        "id_n": len(id_labels),
        "ood_n": len(ood_labels),
        "dataset": {
            "name": "DynaSent",
            "id_split": "dynasent-r1 / test",
            "ood_split": "dynasent-r2 / test",
            "license": "CC BY 4.0",
            "citation": "Potts et al., ACL 2021",
            "url": "https://huggingface.co/datasets/cgpotts/dynasent",
            "label_filter": label_filter,
        },
    }
