import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/auth";
import { corsJson, corsOptions } from "@/lib/cors";
import { lookupDynaSent, availableModels } from "@/lib/dynasent-mock-data";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return corsJson({ error: auth.error }, { status: 401 });
  }

  const body = await req.json();
  const { task, model } = body as {
    task: string;
    model: { vendor: string; endpoint?: string };
    config?: { label_filter?: string };
  };

  if (task !== "sentiment_ood") {
    return corsJson(
      { error: `Unsupported task: ${task}. Supported: sentiment_ood` },
      { status: 400 },
    );
  }

  const vendor = model?.vendor ?? "";
  const endpoint = model?.endpoint ?? "";

  if (!vendor || !endpoint) {
    return corsJson(
      { error: "model.vendor and model.endpoint are required" },
      { status: 400 },
    );
  }

  // If EVAL_BACKEND_URL is set, proxy to the Python FastAPI sidecar
  const evalBackendUrl = process.env.EVAL_BACKEND_URL;
  if (evalBackendUrl) {
    try {
      const backendRes = await fetch(`${evalBackendUrl}/eval/sentiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_vendor: vendor,
          model_endpoint: endpoint,
          config: body.config ?? null,
        }),
      });
      const data = await backendRes.json();
      return corsJson(data, { status: backendRes.status });
    } catch (err) {
      return corsJson(
        { error: "Eval backend unavailable", detail: String(err) },
        { status: 502 },
      );
    }
  }

  // Fallback: mock data
  const result = lookupDynaSent(vendor, endpoint);

  if (!result) {
    return corsJson(
      {
        error: `No pre-computed results for ${vendor}/${endpoint}`,
        available_models: availableModels(),
      },
      { status: 404 },
    );
  }

  return corsJson(
    {
      task: "sentiment_ood",
      source: "mock_precomputed_v1",
      ...result,
    },
    { status: 200 },
  );
}
