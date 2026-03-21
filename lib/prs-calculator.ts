/**
 * Production Readiness Score (PRS) Calculator
 *
 * PRS = 100 × (W_TRUST × trust_score_id + W_DRIFT × drift_stability + W_CII × conf_integrity + W_AUROC × ood_auroc)
 * Weights are determined by the selected use-case profile.
 */

import kv from '@/lib/kv';

export type UseCaseProfile = 'default' | 'high_stakes' | 'commodity' | 'multi_domain';

export const PRS_WEIGHT_PROFILES: Record<UseCaseProfile, {
  trust: number;
  drift: number;
  cii: number;
  auroc: number;
  label: string;
  description: string;
}> = {
  default: {
    trust: 0.30, drift: 0.25, cii: 0.25, auroc: 0.20,
    label: 'General (Default)',
    description: 'Balanced weighting across all four dimensions.',
  },
  high_stakes: {
    trust: 0.40, drift: 0.25, cii: 0.25, auroc: 0.10,
    label: 'High-Stakes',
    description: 'Prioritizes baseline calibration quality and confidence integrity. For medical, legal, financial deployments.',
  },
  commodity: {
    trust: 0.25, drift: 0.30, cii: 0.20, auroc: 0.25,
    label: 'Commodity & Volume',
    description: 'Emphasizes drift stability and OOD detection. For high-throughput classification at scale.',
  },
  multi_domain: {
    trust: 0.25, drift: 0.35, cii: 0.20, auroc: 0.20,
    label: 'Multi-Domain & Global',
    description: 'Heaviest weighting on drift stability. For multilingual, cross-domain, international deployments.',
  },
};

// Validate all profiles sum to 1.0 at module load
for (const [name, w] of Object.entries(PRS_WEIGHT_PROFILES)) {
  const sum = w.trust + w.drift + w.cii + w.auroc;
  if (Math.abs(sum - 1.0) > 1e-9) {
    throw new Error(`PRS weights for profile '${name}' must sum to 1.0, got ${sum}`);
  }
}

export interface PRSInput {
  vendor_id: string;
  eval_date: string;
  trust_score_id: number;
  mean_ece_shift?: number;
  max_cii?: number;
  ood_detection_auroc?: number;
  use_case_profile?: UseCaseProfile;
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
  use_case_profile: UseCaseProfile;
  weights_applied: { trust: number; drift: number; cii: number; auroc: number };
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
    profile_label: string;
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

  // Resolve weight profile
  const profile = input.use_case_profile ?? 'default';
  const weights = PRS_WEIGHT_PROFILES[profile];
  const W_TRUST = weights.trust;
  const W_DRIFT = weights.drift;
  const W_CII = weights.cii;
  const W_AUROC = weights.auroc;

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
    use_case_profile: profile,
    weights_applied: { trust: W_TRUST, drift: W_DRIFT, cii: W_CII, auroc: W_AUROC },
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
      profile_label: weights.label,
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

export async function fetchOODFromKV(
  vendor_id: string,
  task_category: string,
): Promise<{ mean_ece_shift: number | undefined; max_cii: number | undefined; ood_detection_auroc: number | undefined }> {
  const key = `ood:${vendor_id}:${task_category}:latest`;
  const stored = await kv.get(key) as Record<string, unknown> | null;
  if (!stored) return { mean_ece_shift: undefined, max_cii: undefined, ood_detection_auroc: undefined };
  return {
    mean_ece_shift: typeof stored.mean_ece_shift === 'number' ? stored.mean_ece_shift : undefined,
    max_cii: typeof stored.max_cii === 'number' ? stored.max_cii : undefined,
    ood_detection_auroc: typeof stored.ood_detection_auroc === 'number' ? stored.ood_detection_auroc : undefined,
  };
}
