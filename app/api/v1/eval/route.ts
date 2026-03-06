import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/auth";
import { transcribe } from "@/lib/deepgram";
import { kv } from "@/lib/kv";
import crypto from "crypto";

function computeWER(hypothesis: string, reference: string): number {
  const hyp = hypothesis.toLowerCase().split(/\s+/).filter(Boolean);
  const ref = reference.toLowerCase().split(/\s+/).filter(Boolean);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;

  const d: number[][] = Array.from({ length: ref.length + 1 }, () =>
    new Array(hyp.length + 1).fill(0)
  );
  for (let i = 0; i <= ref.length; i++) d[i][0] = i;
  for (let j = 0; j <= hyp.length; j++) d[0][j] = j;

  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        d[i][j] = d[i - 1][j - 1];
      } else {
        d[i][j] = 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
      }
    }
  }

  return parseFloat((d[ref.length][hyp.length] / ref.length).toFixed(4));
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await req.json();
  const { audio_url, ground_truth } = body as {
    audio_url: string;
    ground_truth?: string;
  };

  if (!audio_url) {
    return NextResponse.json(
      { error: "audio_url is required" },
      { status: 400 }
    );
  }

  const submitted_at = new Date().toISOString();
  const result = await transcribe(audio_url);
  const completed_at = new Date().toISOString();

  const wer =
    ground_truth !== undefined
      ? computeWER(result.transcript, ground_truth)
      : null;

  const eval_id = crypto.randomUUID();

  const evalResult = {
    eval_id,
    status: "complete" as const,
    submitted_at,
    completed_at,
    results: [
      {
        vendor: "deepgram",
        transcript: result.transcript,
        latency_ms: result.latency_ms,
        cost_usd: result.cost_usd,
        wer,
        rank: 1,
      },
    ],
    recommendation: {
      best_accuracy: "deepgram",
      best_speed: "deepgram",
      best_cost: "deepgram",
      balanced: "deepgram",
    },
  };

  await kv.set(`eval:${eval_id}`, evalResult, 86400);

  return NextResponse.json(evalResult);
}
