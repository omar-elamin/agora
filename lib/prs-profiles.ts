/**
 * Client-safe PRS weight profile data.
 *
 * This module re-declares the weight profiles from prs-calculator.ts
 * so that client components can access them without pulling in
 * server-only dependencies (kv → fs).
 *
 * Keep in sync with PRS_WEIGHT_PROFILES in lib/prs-calculator.ts.
 */

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
