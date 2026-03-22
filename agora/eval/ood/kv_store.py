"""Persist OODPipelineResult to .dev-kv.json (file-based KV used by lib/kv.ts)."""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from agora.eval.ood.pipeline import OODPipelineResult, OODSetResult

_DEFAULT_KV_PATH = Path(__file__).parent.parent.parent.parent / ".dev-kv.json"


def save_ood_results(
    vendor_id: str,
    task_category: str,
    result: OODPipelineResult,
    kv_path: Path | None = None,
) -> None:
    kv_path = kv_path or _DEFAULT_KV_PATH
    data: dict = {}
    if kv_path.exists():
        text = kv_path.read_text().strip()
        if text:
            data = json.loads(text)

    serialized = asdict(result)

    key1 = f"ood:{vendor_id}:{task_category}:{result.eval_date}"
    key2 = f"ood:{vendor_id}:{task_category}:latest"
    data[key1] = serialized
    data[key2] = serialized

    kv_path.write_text(json.dumps(data, indent=2))


def load_ood_results(
    vendor_id: str,
    task_category: str,
    kv_path: Path | None = None,
) -> OODPipelineResult | None:
    kv_path = kv_path or _DEFAULT_KV_PATH
    if not kv_path.exists():
        return None

    data = json.loads(kv_path.read_text())
    key = f"ood:{vendor_id}:{task_category}:latest"
    stored = data.get(key)
    if stored is None:
        return None

    per_set_results = [OODSetResult(**s) for s in stored.pop("per_set_results", [])]
    return OODPipelineResult(**stored, per_set_results=per_set_results)
