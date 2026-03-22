#!/usr/bin/env python3
"""Run OOD eval against temporalwiki eval set and persist results."""

import json
from pathlib import Path

from agora.eval.ood.pipeline import run_ood_pipeline
from agora.eval.ood.kv_store import save_ood_results

DATA_PATH = Path.home() / "Documents/rachel-vault/research/agora/temporalwiki-eval-set-2026-03-21/test_ood.jsonl"
MAX_LINES = 200


def main():
    # Load OOD records
    records = []
    if DATA_PATH.exists():
        with open(DATA_PATH) as f:
            for i, line in enumerate(f):
                if i >= MAX_LINES:
                    break
                records.append(json.loads(line))
    else:
        print(f"WARNING: {DATA_PATH} not found, using empty OOD set")

    # Build label mapping
    categories = sorted(set(r.get("category", "unknown") for r in records))
    label_to_int = {cat: idx for idx, cat in enumerate(categories)}
    ood_records = [
        {"text": r["text"], "ground_truth_label": label_to_int.get(r.get("category", "unknown"), 0)}
        for r in records
    ]

    # Mock ID records
    id_records = [{"text": "sample text", "ground_truth_label": 0} for _ in range(50)]

    # Mock inference
    def inference_fn(texts):
        return [(0, 0.7)] * len(texts)

    result = run_ood_pipeline(
        vendor_id="temporal-baseline",
        inference_fn=inference_fn,
        id_records=id_records,
        ood_sets=[{
            "set_name": "temporalwiki-2021-12",
            "shift_type": "temporal",
            "records": ood_records,
        }] if ood_records else [],
    )

    save_ood_results(
        vendor_id="temporal-baseline",
        task_category="text_classification",
        result=result,
    )

    print(f"eval_date:            {result.eval_date}")
    print(f"id_ece:               {result.id_ece:.4f}")
    print(f"id_accuracy:          {result.id_accuracy:.4f}")
    print(f"mean_ece_shift:       {result.mean_ece_shift:.4f}")
    print(f"max_cii:              {result.max_cii:.4f}")
    print(f"ood_detection_auroc:  {result.ood_detection_auroc:.4f}")
    print(f"\nper_set_results ({len(result.per_set_results)}):")
    for s in result.per_set_results:
        print(f"  {s.set_name}: ece_shift={s.ece_shift:.4f} cii={s.cii:.4f} auroc={s.auroc:.4f} n_ood={s.n_ood}")


if __name__ == "__main__":
    main()
