from agora.eval.calibration.types import FDSResult, PredictionRecord


def compute_fds(
    target_vendor_id: str,
    all_predictions: dict[str, list[PredictionRecord]],
    task_category: str,
    high_conf_threshold: float = 0.85,
    min_agreement_vendors: int = 2,
) -> FDSResult:
    """
    Compute Failure Detectability Score for target_vendor_id using cross-vendor probe.

    Raises:
        ValueError: if target_vendor_id not in all_predictions
        ValueError: if fewer than 2 vendors total
        ValueError: if vendors don't share example_ids
    """
    if target_vendor_id not in all_predictions:
        raise ValueError(f"target_vendor_id '{target_vendor_id}' not in all_predictions")

    if len(all_predictions) < 2:
        raise ValueError(
            f"Need at least 2 vendors for cross-vendor comparison, got {len(all_predictions)}"
        )

    aligned = _align_predictions(all_predictions, task_category)

    if not aligned:
        raise ValueError("Vendors don't share any example_ids for the given task_category")

    n_total = len(aligned)
    n_errors = 0
    n_detectable = 0
    n_high_conf_errors = 0
    n_high_conf_flagged = 0
    n_invisible = 0
    cross_vendor_flagged = 0

    for example_id, vendor_preds in aligned.items():
        if target_vendor_id not in vendor_preds:
            continue

        target_pred = vendor_preds[target_vendor_id]
        other_preds = {
            vid: pred for vid, pred in vendor_preds.items()
            if vid != target_vendor_id
        }

        error = _is_error(target_pred)
        flagged = _cross_vendor_flag(
            example_id, target_pred, other_preds, min_agreement_vendors
        )
        high_conf_error = _is_high_conf_error(target_pred, high_conf_threshold)

        if error:
            n_errors += 1
            if flagged:
                n_detectable += 1
                cross_vendor_flagged += 1

        if high_conf_error:
            n_high_conf_errors += 1
            if flagged:
                n_high_conf_flagged += 1
            else:
                n_invisible += 1

    fds_overall = n_detectable / n_errors if n_errors > 0 else 1.0
    fds_high_confidence = (
        n_high_conf_flagged / n_high_conf_errors
        if n_high_conf_errors > 0
        else 0.0
    )
    invisible_failure_rate = n_invisible / n_total if n_total > 0 else 0.0

    eval_date = ""
    target_preds = all_predictions[target_vendor_id]
    for p in target_preds:
        if p.task_category == task_category:
            eval_date = p.eval_date
            break

    return FDSResult(
        vendor_id=target_vendor_id,
        task_category=task_category,
        eval_date=eval_date,
        n_errors=n_errors,
        n_detectable=n_detectable,
        n_high_conf_errors=n_high_conf_errors,
        n_invisible=n_invisible,
        fds_overall=fds_overall,
        fds_high_confidence=fds_high_confidence,
        invisible_failure_rate=invisible_failure_rate,
        probe_details={"cross_vendor": cross_vendor_flagged},
        vendors_in_comparison=sorted(all_predictions.keys()),
        high_conf_threshold=high_conf_threshold,
    )


def _align_predictions(
    all_predictions: dict[str, list[PredictionRecord]],
    task_category: str,
) -> dict[str, dict[str, PredictionRecord]]:
    """
    Align predictions by example_id across vendors.
    Returns: {example_id: {vendor_id: PredictionRecord}}
    Only includes example_ids present in ALL vendors.
    """
    # Build per-vendor index filtered by task_category
    vendor_indices: dict[str, dict[str, PredictionRecord]] = {}
    for vendor_id, preds in all_predictions.items():
        index: dict[str, PredictionRecord] = {}
        for p in preds:
            if p.task_category == task_category:
                index[p.example_id] = p
        vendor_indices[vendor_id] = index

    # Find common example_ids
    common_ids: set[str] | None = None
    for index in vendor_indices.values():
        if common_ids is None:
            common_ids = set(index.keys())
        else:
            common_ids &= set(index.keys())

    if not common_ids:
        return {}

    # Build aligned dict
    aligned: dict[str, dict[str, PredictionRecord]] = {}
    for eid in common_ids:
        aligned[eid] = {
            vid: vendor_indices[vid][eid]
            for vid in vendor_indices
        }

    return aligned


def _cross_vendor_flag(
    example_id: str,
    target_pred: PredictionRecord,
    other_preds: dict[str, PredictionRecord],
    min_agreement_vendors: int,
) -> bool:
    """
    Returns True if >= min_agreement_vendors other vendors predict a DIFFERENT label
    than target_vendor on this example.

    Only count vendors that have confidence_available=True and confidence >= 0.50.
    """
    disagreements = 0
    for vid, pred in other_preds.items():
        if not pred.confidence_available:
            continue
        if pred.confidence < 0.50:
            continue
        if pred.predicted_label != target_pred.predicted_label:
            disagreements += 1

    return disagreements >= min_agreement_vendors


def _is_error(pred: PredictionRecord) -> bool:
    """Returns True if prediction is incorrect."""
    return pred.predicted_label != pred.ground_truth_label


def _is_high_conf_error(pred: PredictionRecord, threshold: float) -> bool:
    """Returns True if prediction is incorrect AND confidence >= threshold."""
    return _is_error(pred) and pred.confidence >= threshold


def _fds_label(fds: float) -> tuple[str, str]:
    """
    Return (label, color) for FDS value.
    """
    if fds >= 0.85:
        return ("Most failures catchable", "green")
    elif fds >= 0.65:
        return ("Partially detectable", "yellow")
    else:
        return ("High hidden failure risk", "red")


def _invisible_failure_label(rate: float) -> tuple[str, str]:
    """
    Return (label, color) for invisible failure rate.
    """
    if rate <= 0.005:
        return ("Low risk", "green")
    elif rate <= 0.020:
        return ("Moderate risk", "yellow")
    else:
        return ("High risk — review before production", "red")
