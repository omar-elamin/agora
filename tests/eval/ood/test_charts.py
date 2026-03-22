"""Tests for OOD eval chart generation."""
import tempfile
from dataclasses import dataclass
from pathlib import Path

import pytest

from agora.eval.ood.charts import generate_eval_charts, generate_chart_captions


@dataclass
class FakeSetResult:
    set_name: str
    ood_accuracy: float
    shift_type: str = "temporal"
    n_ood: int = 100
    n_id: int = 100
    id_ece: float = 0.05
    ood_ece: float = 0.10
    ece_shift: float = 0.05
    id_accuracy: float = 0.90
    mean_conf_id: float = 0.85
    mean_conf_ood: float = 0.70
    cii: float = 1.1
    auroc: float = 0.75


@dataclass
class FakePipelineResult:
    per_set_results: list
    vendor_id: str = "test-vendor"
    eval_date: str = "2026-03-21"
    id_ece: float = 0.05
    id_accuracy: float = 0.90
    id_n: int = 100
    mean_ece_shift: float = 0.05
    max_cii: float = 1.1
    ood_detection_auroc: float = 0.75


@pytest.fixture
def result_with_sets():
    return FakePipelineResult(
        per_set_results=[
            FakeSetResult(set_name="2024-Q1", ood_accuracy=0.85),
            FakeSetResult(set_name="2024-Q2", ood_accuracy=0.78),
            FakeSetResult(set_name="2024-Q3", ood_accuracy=0.60),
        ]
    )


@pytest.fixture
def result_empty():
    return FakePipelineResult(per_set_results=[])


class TestGenerateEvalCharts:
    def test_creates_drift_curve_png(self, result_with_sets):
        with tempfile.TemporaryDirectory() as tmpdir:
            paths = generate_eval_charts(result_with_sets, tmpdir)
            drift_path = Path(paths["drift_curve"])
            assert drift_path.exists()
            assert drift_path.stat().st_size > 0
            assert drift_path.name == "drift-curve.png"

    def test_creates_category_breakdown_png(self, result_with_sets):
        with tempfile.TemporaryDirectory() as tmpdir:
            paths = generate_eval_charts(result_with_sets, tmpdir)
            cat_path = Path(paths["category_breakdown"])
            assert cat_path.exists()
            assert cat_path.stat().st_size > 0
            assert cat_path.name == "category-breakdown.png"

    def test_creates_both_pngs_empty_result(self, result_empty):
        with tempfile.TemporaryDirectory() as tmpdir:
            paths = generate_eval_charts(result_empty, tmpdir)
            for key in ("drift_curve", "category_breakdown"):
                p = Path(paths[key])
                assert p.exists()
                assert p.stat().st_size > 0

    def test_with_per_category_data(self, result_with_sets):
        cat_data = [
            {"category": "POLITICS", "train_acc": 0.85, "ood_acc": 0.68, "delta": -0.17},
            {"category": "TECH", "train_acc": 0.78, "ood_acc": 0.71, "delta": -0.07},
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            paths = generate_eval_charts(result_with_sets, tmpdir, per_category_data=cat_data)
            cat_path = Path(paths["category_breakdown"])
            assert cat_path.exists()
            assert cat_path.stat().st_size > 0

    def test_output_dir_created_if_missing(self, result_with_sets):
        with tempfile.TemporaryDirectory() as tmpdir:
            nested = Path(tmpdir) / "sub" / "dir"
            paths = generate_eval_charts(result_with_sets, nested)
            assert nested.exists()
            assert Path(paths["drift_curve"]).exists()


class TestGenerateChartCaptions:
    def test_captions_with_sets(self, result_with_sets):
        captions = generate_chart_captions(result_with_sets)
        assert "85.0%" in captions["drift_curve"]
        assert "60.0%" in captions["drift_curve"]
        assert "not available" in captions["category_breakdown"]

    def test_captions_empty_sets(self, result_empty):
        captions = generate_chart_captions(result_empty)
        assert "No temporal data" in captions["drift_curve"]

    def test_captions_with_category_data(self, result_with_sets):
        cat_data = [
            {"category": "POLITICS", "train_acc": 0.85, "ood_acc": 0.68, "delta": -0.17},
            {"category": "TECH", "train_acc": 0.78, "ood_acc": 0.71, "delta": -0.07},
        ]
        captions = generate_chart_captions(result_with_sets, per_category_data=cat_data)
        assert "POLITICS" in captions["category_breakdown"]
        assert "17.0" in captions["category_breakdown"]
