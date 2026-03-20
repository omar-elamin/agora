import { NextRequest } from "next/server";
import { kv } from "@/lib/kv";
import { corsJson, corsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

interface StoredVendorResult {
  vendor: string;
  wer: number | null;
  latency_ms: number | null;
  cost_usd: number | null;
  rank: number | null;
  trust_score_result?: {
    trust_score: number;
    label: string;
  } | null;
  calibration_result?: {
    label: string;
  } | null;
  reliability_diagram_url?: string | null;
}

interface StoredEvalResult {
  eval_id: string;
  results: StoredVendorResult[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = (await kv.get(`eval:${id}`)) as StoredEvalResult | null;

  if (!result) {
    return corsJson({ error: "Eval not found" }, { status: 404 });
  }

  const vendors = result.results.map((r) => ({
    vendor_id: r.vendor,
    wer: r.wer ?? null,
    latency_ms: r.latency_ms ?? null,
    cost_usd: r.cost_usd ?? null,
    trust_score: r.trust_score_result?.trust_score ?? null,
    trust_score_label: r.trust_score_result?.label ?? null,
    calibration_label: r.calibration_result?.label ?? null,
    reliability_diagram_url: r.reliability_diagram_url ?? null,
    rank: r.rank ?? null,
  }));

  return corsJson({
    eval_id: result.eval_id,
    task_category: "asr",
    vendors,
  });
}
