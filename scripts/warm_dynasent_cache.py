"""Pre-download DynaSent R1 and R2 datasets into the HuggingFace cache."""

from datasets import load_dataset

CONFIGS = [
    "dynabench.dynasent.r1.all",
    "dynabench.dynasent.r2.all",
]

for config in CONFIGS:
    print(f"Downloading dynabench/dynasent — {config} ...")
    load_dataset("dynabench/dynasent", config)
    print(f"  ✓ {config} cached")

print("Done — all DynaSent splits cached.")
