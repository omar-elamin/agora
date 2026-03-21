/**
 * Production Readiness Score (PRS) Calculator
 *
 * PRS = 100 × (0.30 × trust_score_id + 0.30 × drift_stability + 0.20 × conf_integrity + 0.20 × ood_auroc)
 */

const W_TRUST = 0.30;
const W_DRIFT = 0.30;
const W_CII = 0.20;
const W_AUROC = 0.20;

// Validate weights sum to 1.0
const weightSum = W_TRUST + W_DRIFT + W_CII + W_AUROC;
if (Math.abs(weightSum - 1.0) > 1e-9) {
  throw new Error(`PRS weights must sum to 1.0, got ${weightSum}`);
}

export interface PRSInput {
  vendor_id: string;
  eval_date: string;
  trust_score_id: number;
  mean_ece_shift?: number;
  max_cii?: number;
  ood_detection_auroc?: number;
}

export interface PRSResult {
  vendor_id: string;
  eval_date: string;
  trust_score_id: number;
  drift_stability: number;
  confidence_integrity: number;
  ood_detection_auroc: number;
  ece_shift_norm: number;
  cii_norm: number;
  prs_raw: number;
  prs_final: number;
  soft_cap_applied: boolean;
  label_computed: string;
  override_triggered: boolean;
  label_displayed: string;
  buyer_caveat: string | null;
  silent_drift_risk: boolean;
  low_id_trust: boolean;
  untrusted_id: boolean;
  ood_data_missing: boolean;
  buyer_display: {
    score: number;
    label: string;
    caveat: string | null;
    silent_drift_warning: string | null;
    component_bars: {
      id_calibration_quality: number;
      drift_stability: number;
      confidence_integrity: number;
      ood_detection: number;
    };
  };
}

function getLabel(score: number): string {
  if (score >= 85) return "Production-ready";
  if (score >= 70) return "Solid for stable deployments";
  if (score >= 55) return "Requires monitoring infrastructure";
  return "Not recommended for production without calibration work";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computePRS(input: PRSInput): PRSResult {
  const { vendor_id, eval_date, trust_score_id } = input;

  // OOD fallback
  const ood_data_missing =
    input.mean_ece_shift === undefined ||
    input.max_cii === undefined ||
    input.ood_detection_auroc === undefined;

  const mean_ece_shift = ood_data_missing ? Infinity : input.mean_ece_shift!;
  const max_cii = ood_data_missing ? 2.0 : input.max_cii!;
  const ood_detection_auroc = ood_data_missing ? 0.5 : input.ood_detection_auroc!;

  // Normalization
  const ece_shift_norm = Math.min(1, mean_ece_shift / 0.20);
  const cii_norm = Math.min(1, Math.max(0, max_cii - 1.0));
  const drift_stability = 1 - ece_shift_norm;
  const confidence_integrity = 1 - cii_norm;

  // Core formula
  const prs_raw = round1(
    100 * (W_TRUST * trust_score_id + W_DRIFT * drift_stability + W_CII * confidence_integrity + W_AUROC * ood_detection_auroc)
  );

  // Soft cap
  const soft_cap_applied = trust_score_id < 0.60 && prs_raw > 70.0;
  let prs_final = soft_cap_applied ? 70.0 : prs_raw;

  // Labels
  const label_computed = getLabel(prs_final);

  // Override
  const override_triggered = trust_score_id < 0.40;
  const label_displayed = override_triggered
    ? "Requires monitoring infrastructure"
    : label_computed;
  const buyer_caveat = override_triggered
    ? "ID trust score is below 0.40 — this vendor's confidence signals are not reliable enough for autonomous production use. Human-in-the-loop monitoring is strongly recommended."
    : null;

  // Flags
  const silent_drift_risk = max_cii > 1.20 && mean_ece_shift > 0.10 && trust_score_id > 0.75;
  const low_id_trust = trust_score_id >= 0.40 && trust_score_id < 0.60;
  const untrusted_id = trust_score_id < 0.40;

  const silent_drift_warning = silent_drift_risk
    ? "⚠️ Silent Drift Risk: This vendor's confidence scores become unreliable under distribution shift. As your production data evolves, errors will increasingly look like correct predictions. Requires active monitoring infrastructure."
    : null;

  return {
    vendor_id,
    eval_date,
    trust_score_id,
    drift_stability,
    confidence_integrity,
    ood_detection_auroc,
    ece_shift_norm,
    cii_norm,
    prs_raw,
    prs_final,
    soft_cap_applied,
    label_computed,
    override_triggered,
    label_displayed,
    buyer_caveat,
    silent_drift_risk,
    low_id_trust,
    untrusted_id,
    ood_data_missing,
    buyer_display: {
      score: prs_final,
      label: label_displayed,
      caveat: buyer_caveat,
      silent_drift_warning,
      component_bars: {
        id_calibration_quality: trust_score_id,
        drift_stability,
        confidence_integrity,
        ood_detection: ood_detection_auroc,
      },
    },
  };
}
