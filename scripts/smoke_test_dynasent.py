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

# --- Step 3: raw HuggingFace load for R2 ---
ds_r2 = load_dataset(
    "dynabench/dynasent", "dynabench.dynasent.r2.all", split="test"
)
assert len(ds_r2) > 0, "Raw HF load returned empty dataset for R2"
print(f"[smoke] HF load_dataset R2 OK — {len(ds_r2)} examples")

# --- Step 4: agora loader end-to-end for R2 ---
texts_r2, labels_r2 = load_dynasent("dynasent-r2", split="test")
assert len(texts_r2) > 0, "load_dynasent R2 returned empty texts"
assert len(texts_r2) == len(labels_r2), "R2 texts/labels length mismatch"
print(f"[smoke] load_dynasent R2 OK — {len(texts_r2)} examples")

print("[smoke] All checks passed")
