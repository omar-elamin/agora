import json
import os
import tempfile

import pytest

from agora.eval.calibration.calibration_pipeline import (
    run_calibration_pipeline,
    run_multi_vendor_comparison,
    generate_comparison_insight,
)
from agora.eval.calibration.types import PredictionRecord


SVG_OUTPUT_DIR = "/tmp/agora-test-svgs"


def _make_pred(
    example_id, vendor_id, predicted, ground_truth, confidence,
    task_category="language_id", eval_date="2026-03-19",
) -> PredictionRecord:
    return PredictionRecord(
        example_id=example_id,
        vendor_id=vendor_id,
        predicted_label=predicted,
        ground_truth_label=ground_truth,
        confidence=confidence,
        full_probs=None,
        task_category=task_category,
        eval_date=eval_date,
    )


def _build_synthetic_vendors():
    """
    Build 3 synthetic vendors with known properties:
    - vendor_good: high accuracy, well-calibrated
    - vendor_overconf: decent accuracy but overconfident
    - vendor_bad: low accuracy, poorly calibrated
    """
    import random
    random.seed(42)
    n = 100
    labels = ["en", "es", "fr", "de"]
    task = "language_id"
    date = "2026-03-19"

    all_preds: dict[str, list[PredictionRecord]] = {
        "vendor_good": [],
        "vendor_overconf": [],
        "vendor_bad": [],
    }

    for i in range(n):
        eid = f"eval-{i:04d}"
        gt = labels[i % len(labels)]

        # vendor_good: 95% accuracy, confidence roughly matches accuracy
        if random.random() < 0.95:
            pred_good = gt
            conf_good = 0.85 + random.random() * 0.15
        else:
            pred_good = random.choice([l for l in labels if l != gt])
            conf_good = 0.3 + random.random() * 0.3

        # vendor_overconf: 80% accuracy, always high confidence
        if random.random() < 0.80:
            pred_over = gt
        else:
            pred_over = random.choice([l for l in labels if l != gt])
        conf_over = 0.90 + random.random() * 0.10  # always overconfident

        # vendor_bad: 60% accuracy, random confidence
        if random.random() < 0.60:
            pred_bad = gt
        else:
            pred_bad = random.choice([l for l in labels if l != gt])
        conf_bad = random.random()

        all_preds["vendor_good"].append(_make_pred(
            eid, "vendor_good", pred_good, gt, conf_good, task, date,
        ))
        all_preds["vendor_overconf"].append(_make_pred(
            eid, "vendor_overconf", pred_over, gt, conf_over, task, date,
        ))
        all_preds["vendor_bad"].append(_make_pred(
            eid, "vendor_bad", pred_bad, gt, conf_bad, task, date,
        ))

    return all_preds


class TestFullPipeline:
    """Integration test with 3 synthetic vendors."""

    def test_full_pipeline(self):
        all_preds = _build_synthetic_vendors()

        with tempfile.TemporaryDirectory() as tmpdir:
            reports = run_multi_vendor_comparison(
                vendor_ids=["vendor_good", "vendor_overconf", "vendor_bad"],
                task_category="language_id",
                all_vendor_predictions=all_preds,
                output_dir=tmpdir,
            )

            assert len(reports) == 3

            # Check all vendors have reports
            for vid in ["vendor_good", "vendor_overconf", "vendor_bad"]:
                report = reports[vid]
                assert report.vendor_id == vid
                assert report.calibration is not None
                assert report.trust_score is not None
                assert report.fds is not None
                assert report.reliability_diagram_path is not None
                assert os.path.exists(report.reliability_diagram_path)

            # vendor_good should have better trust score than vendor_bad
            assert reports["vendor_good"].trust_score.trust_score > \
                   reports["vendor_bad"].trust_score.trust_score

            # Check JSON files written
            for vid in ["vendor_good", "vendor_overconf", "vendor_bad"]:
                base = os.path.join(
                    tmpdir, "vendors", vid, "calibration", "language_id"
                )
                assert os.path.exists(
                    os.path.join(base, "calibration-result-2026-03-19.json")
                )
                assert os.path.exists(
                    os.path.join(base, "fds-result-2026-03-19.json")
                )
                assert os.path.exists(
                    os.path.join(base, "trust-score-2026-03-19.json")
                )
                assert os.path.exists(
                    os.path.join(base, "report-2026-03-19.json")
                )

                # Validate JSON schema
                with open(os.path.join(base, "calibration-result-2026-03-19.json")) as f:
                    cal_json = json.load(f)
                assert "ece" in cal_json
                assert "bins" in cal_json
                assert "mce" in cal_json
                assert isinstance(cal_json["bins"], list)

                with open(os.path.join(base, "trust-score-2026-03-19.json")) as f:
                    ts_json = json.load(f)
                assert "trust_score" in ts_json
                assert "component_breakdown" in ts_json

            # Check V2 report files and metadata
            for vid in ["vendor_good", "vendor_overconf", "vendor_bad"]:
                base = os.path.join(
                    tmpdir, "vendors", vid, "calibration", "language_id"
                )
                v2_path = os.path.join(base, "calibration-report-v2-2026-03-19.json")
                assert os.path.exists(v2_path), f"V2 report missing for {vid}"

                with open(v2_path) as f:
                    v2 = json.load(f)
                assert "trust_score_id" in v2
                assert "trust_label" in v2
                assert "ece_adaptive" in v2
                assert "brier" in v2
                assert "fds" in v2
                assert "metrics_normalized" in v2
                assert "flags" in v2
                assert "reliability_diagram" in v2
                assert isinstance(v2["reliability_diagram"], list)
                assert v2["trust_score_id"] >= 0.0
                assert v2["trust_score_id"] <= 1.0

                # Check metadata on legacy report
                report = reports[vid]
                assert "trust_score_id" in report.metadata
                assert "fds_auroc" in report.metadata
                assert "ece_adaptive" in report.metadata
                assert report.calibration.brier_score is not None

            # Check comparison artifacts
            comp_dir = os.path.join(
                tmpdir, "comparisons", "language_id", "2026-03-19"
            )
            assert os.path.exists(os.path.join(comp_dir, "comparison-report.json"))
            assert os.path.exists(os.path.join(comp_dir, "comparison-table.json"))

            with open(os.path.join(comp_dir, "comparison-table.json")) as f:
                table = json.load(f)
            assert table["task_category"] == "language_id"
            assert len(table["vendors"]) == 3
            assert "auto_insight" in table
            assert len(table["auto_insight"]) > 0

            # Copy SVGs to /tmp for visual inspection
            os.makedirs(SVG_OUTPUT_DIR, exist_ok=True)
            for vid in ["vendor_good", "vendor_overconf", "vendor_bad"]:
                src = reports[vid].reliability_diagram_path
                dst = os.path.join(SVG_OUTPUT_DIR, f"{vid}-reliability.svg")
                with open(src) as sf, open(dst, "w") as df:
                    df.write(sf.read())

    def test_single_vendor_pipeline(self):
        """Run pipeline for a single vendor (no FDS possible with 1 vendor)."""
        all_preds = _build_synthetic_vendors()
        single_preds = {"vendor_good": all_preds["vendor_good"]}

        with tempfile.TemporaryDirectory() as tmpdir:
            report = run_calibration_pipeline(
                vendor_id="vendor_good",
                task_category="language_id",
                predictions=all_preds["vendor_good"],
                all_vendor_predictions=single_preds,
                output_dir=tmpdir,
            )
            assert report.calibration is not None
            assert report.fds is None  # can't do FDS with 1 vendor
            assert report.trust_score is not None


class TestComparisonInsight:
    def test_generates_insight(self):
        table = {
            "vendors": [
                {
                    "vendor_id": "vendor_a",
                    "accuracy": 0.95,
                    "ece": 0.20,
                    "trust_score": 80.0,
                    "invisible_failure_rate": 0.001,
                },
                {
                    "vendor_id": "vendor_b",
                    "accuracy": 0.85,
                    "ece": 0.03,
                    "trust_score": 88.0,
                    "invisible_failure_rate": 0.03,
                },
            ],
        }
        insight = generate_comparison_insight(table)
        assert "vendor_a" in insight
        assert "vendor_b" in insight
        assert len(insight) > 20

    def test_empty_vendors(self):
        table = {"vendors": []}
        insight = generate_comparison_insight(table)
        assert "No vendor data" in insight

    def test_high_invisible_rate_warning(self):
        table = {
            "vendors": [
                {
                    "vendor_id": "risky_vendor",
                    "accuracy": 0.8,
                    "ece": 0.1,
                    "trust_score": 70.0,
                    "invisible_failure_rate": 0.05,
                },
                {
                    "vendor_id": "safe_vendor",
                    "accuracy": 0.9,
                    "ece": 0.05,
                    "trust_score": 85.0,
                    "invisible_failure_rate": 0.001,
                },
            ],
        }
        insight = generate_comparison_insight(table)
        assert "risky_vendor" in insight
        assert "risk warning" in insight.lower() or "invisible failure rate" in insight
