import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/auth";
import { kv } from "@/lib/kv";
import { corsJson, corsOptions } from "@/lib/cors";
import { computePRS, PRS_WEIGHT_PROFILES } from "@/lib/prs-calculator";
import type { UseCaseProfile } from "@/lib/prs-calculator";

interface OODPerSetResult {
  set_name: string;
  shift_type: string;
  n_ood: number;
  n_id: number;
  id_ece: number;
  ood_ece: number;
  ece_shift: number;
  id_accuracy: number;
  ood_accuracy: number;
  mean_conf_id: number;
  mean_conf_ood: number;
  cii: number;
  auroc: number;
}

interface OODPipelineResult {
  vendor_id: string;
  eval_date: string;
  id_ece: number;
  id_accuracy: number;
  id_n: number;
  per_set_results: OODPerSetResult[];
  mean_ece_shift: number;
  max_cii: number;
  ood_detection_auroc: number;
}

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vendor_id: string }> },
) {
  const apiKey = req.headers.get("x-api-key");
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return corsJson({ error: auth.error }, { status: 401 });
  }

  const { vendor_id } = await params;
  const task_category = req.nextUrl.searchParams.get("task_category") ?? "asr";
  const use_case_profile = req.nextUrl.searchParams.get("use_case_profile") ?? "default";

  const VALID_PROFILES = Object.keys(PRS_WEIGHT_PROFILES);
  if (!VALID_PROFILES.includes(use_case_profile)) {
    return corsJson(
      { error: `Invalid use_case_profile '${use_case_profile}'. Valid values: ${VALID_PROFILES.join(", ")}` },
      { status: 400 },
    );
  }

  const oodKey = `ood:${vendor_id}:${task_category}:latest`;
  const oodData = (await kv.get(oodKey)) as OODPipelineResult | null;

  if (!oodData) {
    return corsJson({ error: "No OOD profile found for vendor" }, { status: 404 });
  }

  // Read trust score, default to 0.5 if missing
  const trustKey = `trust:${vendor_id}:${task_category}:latest`;
  const trustData = (await kv.get(trustKey)) as { trust_score: number } | null;
  const trust_score = trustData?.trust_score ?? 0.5;

  const prs_contribution = computePRS({
    vendor_id,
    eval_date: oodData.eval_date,
    trust_score_id: trust_score,
    mean_ece_shift: oodData.mean_ece_shift,
    max_cii: oodData.max_cii,
    ood_detection_auroc: oodData.ood_detection_auroc,
    use_case_profile: use_case_profile as UseCaseProfile,
  });

  return corsJson({
    vendor_id,
    task_category,
    eval_date: oodData.eval_date,
    id_ece: oodData.id_ece,
    id_accuracy: oodData.id_accuracy,
    per_set_results: oodData.per_set_results,
    aggregates: {
      mean_ece_shift: oodData.mean_ece_shift,
      max_cii: oodData.max_cii,
      ood_detection_auroc: oodData.ood_detection_auroc,
    },
    prs_contribution,
  });
}
