/**
 * Pre-computed mock DynaSent R1/R2 sentiment eval results.
 *
 * R1 = in-distribution (Stanford SST-style), R2 = adversarial subpopulation shift.
 * Test-set sizes: 1 200 per round.
 */

export interface DynaSentResult {
  id_accuracy: number;
  ood_accuracy: number;
  degradation_delta: number;
  degradation_tier: "robust" | "moderate" | "significant";
  id_n: number;
  ood_n: number;
}

function tier(delta: number): DynaSentResult["degradation_tier"] {
  if (delta < 0.05) return "robust";
  if (delta < 0.15) return "moderate";
  return "significant";
}

function entry(idAcc: number, oodAcc: number): DynaSentResult {
  const delta = +(idAcc - oodAcc).toFixed(4);
  return {
    id_accuracy: idAcc,
    ood_accuracy: oodAcc,
    degradation_delta: delta,
    degradation_tier: tier(delta),
    id_n: 1200,
    ood_n: 1200,
  };
}

/** key = "vendor/endpoint" */
const MOCK_DATA = new Map<string, DynaSentResult>([
  ["openai/gpt-4o-mini", entry(0.782, 0.691)],
  ["openai/gpt-4o", entry(0.913, 0.842)],
  ["anthropic/claude-3-haiku-20240307", entry(0.801, 0.734)],
  ["anthropic/claude-3.5-sonnet-20241022", entry(0.927, 0.889)],
  ["google/gemini-1.5-flash", entry(0.817, 0.709)],
]);

function normalizeKey(vendor: string, endpoint: string): string {
  return `${vendor.toLowerCase()}/${endpoint.toLowerCase()}`;
}

export function lookupDynaSent(
  vendor: string,
  endpoint: string,
): DynaSentResult | undefined {
  return MOCK_DATA.get(normalizeKey(vendor, endpoint));
}

export function availableModels(): string[] {
  return Array.from(MOCK_DATA.keys());
}
