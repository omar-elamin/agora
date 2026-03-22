"""OOD (Out-of-Distribution) evaluation pipeline."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import date
from typing import Callable


@dataclass
class OODSetResult:
    set_name: str
    shift_type: str
    n_ood: int
    n_id: int
    id_ece: float
    ood_ece: float
    ece_shift: float
    id_accuracy: float
    ood_accuracy: float
    mean_conf_id: float
    mean_conf_ood: float
    cii: float
    auroc: float


@dataclass
class OODPipelineResult:
    vendor_id: str
    eval_date: str
    id_ece: float
    id_accuracy: float
    id_n: int
    per_set_results: list[OODSetResult] = field(default_factory=list)
    mean_ece_shift: float = 0.0
    max_cii: float = 1.0
    ood_detection_auroc: float = 0.5


def _compute_ece(confidences: list[float], corrects: list[bool], n_bins: int = 10) -> float:
    total = len(confidences)
    if total == 0:
        return 0.0
    ece = 0.0
    for b in range(n_bins):
        lo = b / n_bins
        hi = (b + 1) / n_bins
        indices = [i for i in range(total) if lo <= confidences[i] < hi or (b == n_bins - 1 and confidences[i] == hi)]
        if not indices:
            continue
        avg_conf = sum(confidences[i] for i in indices) / len(indices)
        accuracy = sum(1 for i in indices if corrects[i]) / len(indices)
        ece += abs(avg_conf - accuracy) * (len(indices) / total)
    return ece


def _compute_auroc(id_confs: list[float], ood_confs: list[float]) -> float:
    if not id_confs or not ood_confs:
        return 0.5
    random.seed(42)
    n_pairs = min(1000, len(id_confs) * len(ood_confs))
    wins = 0
    for _ in range(n_pairs):
        id_c = random.choice(id_confs)
        ood_c = random.choice(ood_confs)
        if id_c > ood_c:
            wins += 1
        elif id_c == ood_c:
            wins += 0.5
    return wins / n_pairs


def _compute_cii(mean_conf_id: float, mean_conf_ood: float, accuracy_id: float, accuracy_ood: float) -> float:
    if accuracy_ood == 0 or mean_conf_id == 0:
        return 2.0
    return (mean_conf_ood / mean_conf_id) * (accuracy_id / accuracy_ood)


def run_ood_pipeline(
    vendor_id: str,
    inference_fn: Callable[[list[str]], list[tuple[int, float]]],
    id_records: list[dict],
    ood_sets: list[dict],
    eval_date: str | None = None,
) -> OODPipelineResult:
    if eval_date is None:
        eval_date = date.today().isoformat()

    # Run inference on ID records
    id_texts = [r["text"] for r in id_records]
    id_preds = inference_fn(id_texts)
    id_confidences = [p[1] for p in id_preds]
    id_corrects = [p[0] == r["ground_truth_label"] for p, r in zip(id_preds, id_records)]
    id_ece = _compute_ece(id_confidences, id_corrects)
    id_accuracy = sum(id_corrects) / len(id_corrects) if id_corrects else 0.0
    mean_conf_id = sum(id_confidences) / len(id_confidences) if id_confidences else 0.0

    per_set_results: list[OODSetResult] = []

    for ood_set in ood_sets:
        ood_texts = [r["text"] for r in ood_set["records"]]
        ood_preds = inference_fn(ood_texts)
        ood_confidences = [p[1] for p in ood_preds]
        ood_corrects = [p[0] == r["ground_truth_label"] for p, r in zip(ood_preds, ood_set["records"])]
        ood_ece = _compute_ece(ood_confidences, ood_corrects)
        ood_accuracy = sum(ood_corrects) / len(ood_corrects) if ood_corrects else 0.0
        mean_conf_ood = sum(ood_confidences) / len(ood_confidences) if ood_confidences else 0.0

        cii = _compute_cii(mean_conf_id, mean_conf_ood, id_accuracy, ood_accuracy)
        auroc = _compute_auroc(id_confidences, ood_confidences)

        per_set_results.append(OODSetResult(
            set_name=ood_set["set_name"],
            shift_type=ood_set["shift_type"],
            n_ood=len(ood_set["records"]),
            n_id=len(id_records),
            id_ece=id_ece,
            ood_ece=ood_ece,
            ece_shift=ood_ece - id_ece,
            id_accuracy=id_accuracy,
            ood_accuracy=ood_accuracy,
            mean_conf_id=mean_conf_id,
            mean_conf_ood=mean_conf_ood,
            cii=cii,
            auroc=auroc,
        ))

    # Aggregation
    if per_set_results:
        mean_ece_shift = sum(s.ece_shift for s in per_set_results) / len(per_set_results)
        max_cii = max(s.cii for s in per_set_results)
        ood_detection_auroc = sum(s.auroc for s in per_set_results) / len(per_set_results)
    else:
        mean_ece_shift = 0.0
        max_cii = 1.0
        ood_detection_auroc = 0.5

    return OODPipelineResult(
        vendor_id=vendor_id,
        eval_date=eval_date,
        id_ece=id_ece,
        id_accuracy=id_accuracy,
        id_n=len(id_records),
        per_set_results=per_set_results,
        mean_ece_shift=mean_ece_shift,
        max_cii=max_cii,
        ood_detection_auroc=ood_detection_auroc,
    )
