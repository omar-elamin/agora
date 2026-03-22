import json
import os
from dataclasses import asdict
from typing import Optional

from agora.eval.calibration.brier import compute_brier_score, decompose_brier_score
from agora.eval.calibration.ece import compute_ece, compute_adaptive_ece
from agora.eval.calibration.fds_auroc import compute_fds_auroc
from agora.eval.calibration.fds_probe import compute_fds, _fds_label, _invisible_failure_label
from agora.eval.calibration.normalize import normalize_predictions
from agora.eval.calibration.reliability_diagram import (
    generate_reliability_diagram,
    reliability_diagram_path,
)
from agora.eval.calibration.trust_score import TrustScoreWeights, compute_trust_score
from agora.eval.calibration.trust_score_id import compute_trust_score_id
from agora.eval.calibration.types import (
    CalibrationReportV2,
    MetricsNormalized,
    PredictionRecord,
    ReliabilityBin,
    VendorCalibrationReport,
)


def run_calibration_pipeline(
    vendor_id: str,
    task_category: str,
    predictions: list[PredictionRecord],
    all_vendor_predictions: dict[str, list[PredictionRecord]],
    output_dir: str,
    n_bins: int = 10,
    high_conf_threshold: float = 0.85,
    trust_score_weights: Optional[TrustScoreWeights] = None,
    normalize_first: bool = True,
    raw_predictions: Optional[list[dict]] = None,
    vendor_config: Optional[dict] = None,
) -> VendorCalibrationReport:
    """
    Run the full calibration pipeline for one vendor.

    If normalize_first is True and raw_predictions is provided, the raw
    predictions are normalized into PredictionRecords before running
    the pipeline. The normalized records replace the predictions argument.
    """
    if normalize_first and raw_predictions is not None:
        predictions = normalize_predictions(raw_predictions, vendor_config)

    # 1. ECE
    calibration = compute_ece(predictions, n_bins)

    # 1b. Brier Score
    brier = compute_brier_score(predictions) if predictions else 0.0
    calibration.brier_score = round(brier, 6)

    # 1b2. Brier decomposition
    brier_decomp = None
    if predictions:
        try:
            brier_decomp = decompose_brier_score(predictions, n_bins)
        except ValueError:
            pass

    # 1c. Adaptive ECE
    ece_adaptive = compute_adaptive_ece(predictions)

    # 2. Reliability diagram
    diagram_dir = os.path.join(
        output_dir, "vendors", vendor_id, "calibration", task_category
    )
    os.makedirs(diagram_dir, exist_ok=True)
    eval_date = calibration.eval_date
    diagram_path = os.path.join(diagram_dir, f"reliability-{eval_date}.svg")
    generate_reliability_diagram(calibration, diagram_path)

    # 3. FDS (probe-based, for backward compat)
    fds_result = None
    if len(all_vendor_predictions) >= 2:
        fds_result = compute_fds(
            target_vendor_id=vendor_id,
            all_predictions=all_vendor_predictions,
            task_category=task_category,
            high_conf_threshold=high_conf_threshold,
        )

    # 3b. FDS via AUROC
    fds_auroc_result = compute_fds_auroc(predictions) if predictions else None

    # 4. Trust Score (old, for backward compat)
    n_correct = sum(
        1 for p in predictions
        if p.predicted_label == p.ground_truth_label
    )
    accuracy = n_correct / len(predictions) if predictions else 0.0

    trust_result = compute_trust_score(
        vendor_id=vendor_id,
        task_category=task_category,
        eval_date=eval_date,
        accuracy=accuracy,
        calibration=calibration,
        fds=fds_result,
        weights=trust_score_weights,
    )

    # 5. trust_score_id (new formula)
    n_incorrect = len(predictions) - n_correct
    # Detect number of classes
    unique_labels = set()
    for p in predictions:
        unique_labels.add(p.ground_truth_label)
        unique_labels.add(p.predicted_label)
    n_classes = max(len(unique_labels), 2)

    fds_for_trust_id = fds_auroc_result.fds if fds_auroc_result else 0.5
    ece_val = calibration.ece if calibration.ece is not None else 0.0
    mce_val = calibration.mce if calibration.mce is not None else 0.0

    trust_id_result = compute_trust_score_id(
        ece=ece_val,
        mce=mce_val,
        brier=brier,
        fds=fds_for_trust_id,
        n_classes=n_classes,
        ece_adaptive=ece_adaptive,
        bin_stats=calibration.bins,
        n_incorrect=n_incorrect,
    )

    # 6. Build V2 report
    mce_bin_index = None
    if calibration.bins and calibration.mce is not None:
        populated = [b for b in calibration.bins if b.count > 0]
        if populated:
            mce_bin = max(populated, key=lambda b: b.gap)
            mce_bin_index = mce_bin.bin_index

    reliability_diagram_data = [
        ReliabilityBin(
            bin=b.bin_index + 1,
            conf_range=[round(b.lower, 4), round(b.upper, 4)],
            mean_conf=round(b.mean_conf, 4),
            accuracy=round(b.accuracy, 4),
            count=b.count,
        )
        for b in calibration.bins
        if b.count > 0
    ]

    v2_report = CalibrationReportV2(
        vendor_id=vendor_id,
        task_category=task_category,
        eval_date=eval_date,
        n_examples=len(predictions),
        n_correct=n_correct,
        accuracy=round(accuracy, 6),
        ece=calibration.ece,
        ece_adaptive=ece_adaptive,
        mce=calibration.mce,
        mce_bin_index=mce_bin_index,
        brier=calibration.brier_score,
        fds=fds_for_trust_id,
        metrics_normalized=MetricsNormalized(
            ece_norm=trust_id_result.ece_norm,
            mce_norm=trust_id_result.mce_norm,
            brier_norm=trust_id_result.brier_norm,
            fds_norm=trust_id_result.fds_norm,
        ),
        trust_score_id=trust_id_result.trust_score_id,
        trust_label=trust_id_result.trust_label,
        brier_decomposition=brier_decomp,
        flags=trust_id_result.flags,
        reliability_diagram=reliability_diagram_data,
    )

    # 7. Assemble legacy report
    report = VendorCalibrationReport(
        vendor_id=vendor_id,
        task_category=task_category,
        eval_date=eval_date,
        calibration=calibration,
        fds=fds_result,
        trust_score=trust_result,
        reliability_diagram_path=diagram_path,
        metadata={
            "trust_score_id": trust_id_result.trust_score_id,
            "trust_label": trust_id_result.trust_label,
            "fds_auroc": fds_for_trust_id,
            "ece_adaptive": ece_adaptive,
        },
    )

    # 8. Write to storage
    _write_results(report, output_dir)
    _write_v2_report(v2_report, output_dir)

    return report


def run_multi_vendor_comparison(
    vendor_ids: list[str],
    task_category: str,
    all_vendor_predictions: dict[str, list[PredictionRecord]],
    output_dir: str,
    **pipeline_kwargs,
) -> dict[str, VendorCalibrationReport]:
    """
    Run the full pipeline for multiple vendors and return comparison dict.
    """
    reports: dict[str, VendorCalibrationReport] = {}

    for vid in vendor_ids:
        vendor_preds = all_vendor_predictions.get(vid, [])
        filtered = [p for p in vendor_preds if p.task_category == task_category]

        report = run_calibration_pipeline(
            vendor_id=vid,
            task_category=task_category,
            predictions=filtered,
            all_vendor_predictions=all_vendor_predictions,
            output_dir=output_dir,
            **pipeline_kwargs,
        )
        reports[vid] = report

    # Write comparison artifacts
    comparison_table = _build_comparison_table(reports, task_category)
    comparison_table["auto_insight"] = generate_comparison_insight(comparison_table)

    comparison_dir = os.path.join(
        output_dir, "comparisons", task_category,
        reports[vendor_ids[0]].eval_date if vendor_ids else "unknown",
    )
    os.makedirs(comparison_dir, exist_ok=True)

    with open(os.path.join(comparison_dir, "comparison-report.json"), "w") as f:
        json.dump({vid: asdict(r) for vid, r in reports.items()}, f, indent=2)

    with open(os.path.join(comparison_dir, "comparison-table.json"), "w") as f:
        json.dump(comparison_table, f, indent=2)

    return reports


def _build_comparison_table(
    reports: dict[str, VendorCalibrationReport],
    task_category: str,
) -> dict:
    """Build the comparison-table.json structure."""
    eval_date = ""
    vendors_list = []

    for vid, report in reports.items():
        eval_date = report.eval_date

        cal = report.calibration
        fds = report.fds
        ts = report.trust_score

        n_correct = 0
        n_total = cal.n_total
        for b in cal.bins:
            n_correct += round(b.accuracy * b.count)

        accuracy = n_correct / n_total if n_total > 0 else 0.0

        fds_label_text, _ = _fds_label(fds.fds_overall) if fds else ("N/A", "gray")
        inv_label_text, _ = (
            _invisible_failure_label(fds.invisible_failure_rate)
            if fds else ("N/A", "gray")
        )

        vendors_list.append({
            "vendor_id": vid,
            "accuracy": round(accuracy, 4),
            "ece": cal.ece,
            "brier_score": cal.brier_score,
            "fds_overall": fds.fds_overall if fds else None,
            "fds_high_confidence": fds.fds_high_confidence if fds else None,
            "invisible_failure_rate": fds.invisible_failure_rate if fds else None,
            "trust_score": ts.trust_score if ts else None,
            "trust_score_id": report.metadata.get("trust_score_id"),
            "trust_label": report.metadata.get("trust_label"),
            "fds_auroc": report.metadata.get("fds_auroc"),
            "calibration_label": cal.label,
            "fds_label": fds_label_text,
            "invisible_label": inv_label_text,
            "reliability_diagram_path": report.reliability_diagram_path,
        })

    return {
        "task_category": task_category,
        "eval_date": eval_date,
        "vendors": vendors_list,
    }


def generate_comparison_insight(comparison_table: dict) -> str:
    """
    Generate the auto-insight text shown on comparison cards.
    """
    vendors = comparison_table.get("vendors", [])
    if not vendors:
        return "No vendor data available for comparison."

    # Find best accuracy
    best_acc_vendor = max(vendors, key=lambda v: v.get("accuracy", 0))
    # Find best calibration (lowest ECE)
    best_cal_vendor = min(vendors, key=lambda v: v.get("ece", 1.0))

    insights: list[str] = []

    # Key story: accuracy vs calibration tension
    if (best_acc_vendor["vendor_id"] != best_cal_vendor["vendor_id"]
            and best_acc_vendor.get("ece", 0) > 0.15):
        insights.append(
            f"{best_acc_vendor['vendor_id']} has the highest accuracy "
            f"({best_acc_vendor['accuracy']:.1%}) but poor calibration "
            f"(ECE={best_acc_vendor['ece']:.3f}). "
            f"{best_cal_vendor['vendor_id']} is better calibrated "
            f"(ECE={best_cal_vendor['ece']:.3f})."
        )
    elif best_acc_vendor["vendor_id"] == best_cal_vendor["vendor_id"]:
        insights.append(
            f"{best_acc_vendor['vendor_id']} leads in both accuracy "
            f"({best_acc_vendor['accuracy']:.1%}) and calibration "
            f"(ECE={best_acc_vendor['ece']:.3f})."
        )
    else:
        insights.append(
            f"{best_acc_vendor['vendor_id']} has the highest accuracy "
            f"({best_acc_vendor['accuracy']:.1%}). "
            f"{best_cal_vendor['vendor_id']} has the best calibration "
            f"(ECE={best_cal_vendor['ece']:.3f})."
        )

    # Invisible failure rate warnings
    for v in vendors:
        rate = v.get("invisible_failure_rate")
        if rate is not None and rate > 0.02:
            insights.append(
                f"{v['vendor_id']} has {rate:.1%} invisible failure rate "
                f"— risk warning."
            )

    # Trust score recommendation
    scored = [v for v in vendors if v.get("trust_score") is not None]
    if scored:
        best_trust = max(scored, key=lambda v: v["trust_score"])
        insights.append(
            f"For high-stakes deployments, {best_trust['vendor_id']} "
            f"is recommended (Trust Score: {best_trust['trust_score']:.1f})."
        )

    return " ".join(insights)


def _write_results(report: VendorCalibrationReport, output_dir: str) -> None:
    """Write individual result JSON files."""
    base = os.path.join(
        output_dir, "vendors", report.vendor_id,
        "calibration", report.task_category,
    )
    os.makedirs(base, exist_ok=True)
    date = report.eval_date

    # Calibration result
    with open(os.path.join(base, f"calibration-result-{date}.json"), "w") as f:
        json.dump(asdict(report.calibration), f, indent=2)

    # FDS result
    if report.fds:
        with open(os.path.join(base, f"fds-result-{date}.json"), "w") as f:
            json.dump(asdict(report.fds), f, indent=2)

    # Trust score
    if report.trust_score:
        with open(os.path.join(base, f"trust-score-{date}.json"), "w") as f:
            json.dump(asdict(report.trust_score), f, indent=2)

    # Full report
    with open(os.path.join(base, f"report-{date}.json"), "w") as f:
        json.dump(asdict(report), f, indent=2)


def _write_v2_report(report: CalibrationReportV2, output_dir: str) -> None:
    """Write the V2 calibration report JSON."""
    base = os.path.join(
        output_dir, "vendors", report.vendor_id,
        "calibration", report.task_category,
    )
    os.makedirs(base, exist_ok=True)
    date = report.eval_date

    with open(os.path.join(base, f"calibration-report-v2-{date}.json"), "w") as f:
        json.dump(asdict(report), f, indent=2)
