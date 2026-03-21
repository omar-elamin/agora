import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/auth";
import { corsJson, corsOptions } from "@/lib/cors";

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
  const { task } = body as {
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

  return corsJson(
    {
      status: "pending",
      message:
        "Sentiment OOD eval pipeline requires Python backend connection. " +
        "Task registered: sentiment_ood. Run agora/eval/sentiment_ood.py " +
        "with your model_fn to get results.",
      task: "sentiment_ood",
      interface: {
        id_accuracy: "number 0-1",
        ood_accuracy: "number 0-1",
        degradation_delta: "number",
        degradation_tier: "robust|moderate|significant",
      },
    },
    { status: 501 },
  );
}
