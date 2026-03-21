"""Loader for the DynaSent sentiment analysis dataset (Potts et al., ACL 2021)."""

from __future__ import annotations

from typing import Literal

from datasets import load_dataset

VALID_LABELS = {"positive", "negative", "neutral"}

LABEL_MAP: dict[str, int] = {"positive": 0, "negative": 1, "neutral": 2}
INT_TO_LABEL: dict[int, str] = {v: k for k, v in LABEL_MAP.items()}


def load_dynasent(
    config: Literal["dynasent-r1", "dynasent-r2"],
    split: str = "test",
    label_filter: Literal["strict", "ambiguity-inclusive"] = "strict",
    cache_dir: str | None = None,
    expose_r2_train: bool = False,
) -> tuple[list[str], list[int]]:
    """Load DynaSent examples and return (texts, labels).

    Parameters
    ----------
    config : str
        Either ``"dynasent-r1"`` or ``"dynasent-r2"``.
    split : str
        HuggingFace split name (default ``"test"``).
    label_filter : str
        ``"strict"`` drops any example whose ``gold_label`` is not in
        ``VALID_LABELS``.  ``"ambiguity-inclusive"`` maps ``"mixed"`` labels
        to ``"neutral"`` and drops the rest.
    cache_dir : str | None
        Optional cache directory for ``datasets.load_dataset``.
    expose_r2_train : bool
        Must be ``True`` to load the R2 train split.  Defaults to ``False``
        to prevent accidental distribution leakage.

    Returns
    -------
    tuple[list[str], list[int]]
        A pair of parallel lists: raw text strings and integer labels.
    """
    if config == "dynasent-r2" and split == "train" and not expose_r2_train:
        raise ValueError(
            "R2 train split is not exposed by default to prevent distribution "
            "leakage. Pass expose_r2_train=True for fine-tuning experiments."
        )

    ds = load_dataset("dynabench/dynasent", {"dynasent-r1": "dynabench.dynasent.r1.all", "dynasent-r2": "dynabench.dynasent.r2.all"}[config], split=split, cache_dir=cache_dir)

    texts: list[str] = []
    labels: list[int] = []
    filtered_count = 0

    for example in ds:
        gold = example["gold_label"]

        if gold in VALID_LABELS:
            texts.append(example["sentence"])
            labels.append(LABEL_MAP[gold])
        elif label_filter == "ambiguity-inclusive" and gold == "mixed":
            texts.append(example["sentence"])
            labels.append(LABEL_MAP["neutral"])
        else:
            filtered_count += 1

    if filtered_count > 0:
        print(
            f"[dynasent] Filtered {filtered_count} example(s) with labels "
            f"outside {VALID_LABELS} (filter={label_filter})"
        )

    return texts, labels
