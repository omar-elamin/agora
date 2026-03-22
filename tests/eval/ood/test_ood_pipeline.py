"""Tests for the OOD evaluation pipeline."""

import tempfile
from pathlib import Path

from agora.eval.ood.pipeline import (
    OODPipelineResult,
    OODSetResult,
    _compute_cii,
    _compute_ece,
    run_ood_pipeline,
)
from agora.eval.ood.kv_store import load_ood_results, save_ood_results


def test_ece_perfect_calibration():
    confidences = [1.0] * 10
    corrects = [True] * 10
    assert _compute_ece(confidences, corrects) == 0.0


def test_ece_fully_miscalibrated():
    confidences = [1.0] * 10
    corrects = [False] * 10
    assert _compute_ece(confidences, corrects) == 1.0


def test_cii_neutral():
    cii = _compute_cii(
        mean_conf_id=1.0,
        mean_conf_ood=0.8,
        accuracy_id=1.0,
        accuracy_ood=0.8,
    )
    assert abs(cii - 1.0) < 1e-9


def test_ood_pipeline_smoke():
    id_records = [{"text": f"id text {i}", "ground_truth_label": 0} for i in range(20)]
    ood_records = [{"text": f"ood text {i}", "ground_truth_label": 1} for i in range(20)]
    ood_sets = [{"set_name": "test-ood", "shift_type": "synthetic", "records": ood_records}]

    def inference_fn(texts):
        return [(0, 0.7)] * len(texts)

    result = run_ood_pipeline(
        vendor_id="test-vendor",
        inference_fn=inference_fn,
        id_records=id_records,
        ood_sets=ood_sets,
        eval_date="2026-03-21",
    )

    assert result.id_n == 20
    assert len(result.per_set_results) == 1
    assert 0 <= result.ood_detection_auroc <= 1
    assert result.max_cii >= 0


def test_kv_roundtrip():
    result = OODPipelineResult(
        vendor_id="roundtrip-vendor",
        eval_date="2026-03-21",
        id_ece=0.05,
        id_accuracy=0.95,
        id_n=100,
        per_set_results=[
            OODSetResult(
                set_name="s1",
                shift_type="temporal",
                n_ood=50,
                n_id=100,
                id_ece=0.05,
                ood_ece=0.12,
                ece_shift=0.07,
                id_accuracy=0.95,
                ood_accuracy=0.80,
                mean_conf_id=0.90,
                mean_conf_ood=0.85,
                cii=1.05,
                auroc=0.72,
            )
        ],
        mean_ece_shift=0.07,
        max_cii=1.05,
        ood_detection_auroc=0.72,
    )

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        kv_path = Path(f.name)

    save_ood_results("roundtrip-vendor", "asr", result, kv_path=kv_path)
    loaded = load_ood_results("roundtrip-vendor", "asr", kv_path=kv_path)

    assert loaded is not None
    assert loaded.vendor_id == "roundtrip-vendor"
    assert loaded.mean_ece_shift == 0.07

    kv_path.unlink(missing_ok=True)
