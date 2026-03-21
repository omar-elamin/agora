"""Smoke test: verify DynaSent datasets load fully offline inside the eval image."""

import os
import sys

# Ensure offline mode (should already be set in the image ENV)
os.environ["HF_DATASETS_OFFLINE"] = "1"

# --- Step 1: raw HuggingFace load ---
from datasets import load_dataset

ds = load_dataset(
    "dynabench/dynasent", "dynabench.dynasent.r1.all", split="test"
)
assert len(ds) > 0, "Raw HF load returned empty dataset"
print(f"[smoke] HF load_dataset OK — {len(ds)} examples")

# --- Step 2: agora loader end-to-end ---
from agora.loaders.dynasent import load_dynasent

texts, labels = load_dynasent("dynasent-r1", split="test")
assert len(texts) > 0, "load_dynasent returned empty texts"
assert len(texts) == len(labels), "texts/labels length mismatch"
print(f"[smoke] load_dynasent OK — {len(texts)} examples")

print("[smoke] All checks passed")
