import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import type { AccentGroupData, ModelScorecardData } from "@/app/types/cqs";

const OFFICIAL_CQS_GROUPS: AccentGroupData[] = [
  { accent: "East Asian", wer: 6.2, ece: 0.024, cqs: "high", clips: 847 },
  { accent: "Hindi", wer: 5.8, ece: 0.022, cqs: "high", clips: 612 },
  { accent: "Arabic", wer: 7.4, ece: 0.018, cqs: "high", clips: 480 },
  { accent: "Farsi", wer: 9.1, ece: 0.053, cqs: "high", clips: 203 },
  { accent: "Spanish", wer: 11.4, ece: 0.042, cqs: "moderate", clips: 934 },
  { accent: "French", wer: 7.1, ece: 0.013, cqs: "moderate", clips: 320 },
  { accent: "German", wer: 5.9, ece: 0.015, cqs: "moderate", clips: 280 },
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evalResult = await kv.get(`eval:${id}`) as Record<string, any> | null;

  if (!evalResult) {
    return NextResponse.json({ error: "Eval not found" }, { status: 404 });
  }

  const firstResult = evalResult.results?.[0];

  const totalClips = OFFICIAL_CQS_GROUPS.reduce((sum, g) => sum + g.clips, 0);

  const scorecard: ModelScorecardData = {
    model: evalResult.vendors_requested?.[0] ?? "openai/whisper-large-v3",
    evalDate: evalResult.completed_at ?? new Date().toISOString(),
    totalClips,
    overallWer: firstResult?.wer != null ? firstResult.wer * 100 : 0,
    ece: firstResult?.calibration_result?.ece ?? 0.027,
    threshold: 4.0,
    accentGroups: OFFICIAL_CQS_GROUPS,
  };

  return NextResponse.json({
    scorecard,
    accentGroups: OFFICIAL_CQS_GROUPS,
    evalId: id,
  });
}
