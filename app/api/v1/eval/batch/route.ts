import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/auth";
import { transcribe as deepgramTranscribe } from "@/lib/deepgram";
import { transcribe as whisperTranscribe } from "@/lib/whisper";
import { kv } from "@/lib/kv";
import { corsJson, corsOptions } from "@/lib/cors";
import { runCalibration } from "@/lib/calibration";
import type { PredictionRecord } from "@/lib/calibration-types";
import crypto from "crypto";

const SUPPORTED_VENDORS = ["deepgram", "whisper-large-v3"] as const;
type Vendor = (typeof SUPPORTED_VENDORS)[number];

const CONCURRENCY_LIMIT = 5;

interface ClipInput {
  audio_url: string;
  ground_truth: string;
  speaker_group: string;
}

interface ClipResult {
  audio_url: string;
  speaker_group: string;
  vendor: Vendor;
  transcript: string | null;
  wer: number | null;
  error: string | null;
}

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

async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      try {
        const value = await tasks[idx]();
        results[idx] = { status: "fulfilled", value };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

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
  const { clips, vendors } = body as {
    clips: ClipInput[];
    vendors?: string[];
  };

  if (!Array.isArray(clips) || clips.length === 0) {
    return corsJson({ error: "clips array is required and must not be empty" }, { status: 400 });
  }

  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    if (!c.audio_url || !c.ground_truth || !c.speaker_group) {
      return corsJson(
        { error: `clips[${i}] must have audio_url, ground_truth, and speaker_group` },
        { status: 400 },
      );
    }
  }

  const requestedVendors: Vendor[] = vendors
    ? (vendors.filter((v) => SUPPORTED_VENDORS.includes(v as Vendor)) as Vendor[])
    : [...SUPPORTED_VENDORS];

  if (requestedVendors.length === 0) {
    return corsJson(
      { error: `No valid vendors specified. Supported: ${SUPPORTED_VENDORS.join(", ")}` },
      { status: 400 },
    );
  }

  // Build tasks: one per clip+vendor pair
  const tasks: (() => Promise<ClipResult>)[] = [];
  for (const clip of clips) {
    for (const vendor of requestedVendors) {
      tasks.push(async () => {
        const transcribeFn = vendor === "deepgram" ? deepgramTranscribe : whisperTranscribe;
        const result = await transcribeFn(clip.audio_url);
        const wer = computeWER(result.transcript, clip.ground_truth);
        return {
          audio_url: clip.audio_url,
          speaker_group: clip.speaker_group,
          vendor,
          transcript: result.transcript,
          wer,
          error: null,
        };
      });
    }
  }

  const settled = await runWithConcurrencyLimit(tasks, CONCURRENCY_LIMIT);

  // Collect successful results
  const clipResults: ClipResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    const taskIdx = i;
    const clipIdx = Math.floor(taskIdx / requestedVendors.length);
    const vendorIdx = taskIdx % requestedVendors.length;
    return {
      audio_url: clips[clipIdx].audio_url,
      speaker_group: clips[clipIdx].speaker_group,
      vendor: requestedVendors[vendorIdx],
      transcript: null,
      wer: null,
      error: (s.reason as Error)?.message ?? "Unknown error",
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const eval_id = `batch-${crypto.randomUUID()}`;

  // Build PredictionRecords grouped by vendor
  const predictionsByVendor: Record<string, PredictionRecord[]> = {};
  for (const vendor of requestedVendors) {
    predictionsByVendor[vendor] = [];
  }

  for (let i = 0; i < clipResults.length; i++) {
    const cr = clipResults[i];
    if (cr.transcript === null || cr.wer === null) continue;
    const clipIdx = Math.floor(i / requestedVendors.length);
    const pred: PredictionRecord = {
      example_id: `${eval_id}-clip-${clipIdx}`,
      vendor_id: cr.vendor,
      predicted_label: cr.transcript.trim(),
      ground_truth_label: clips[clipIdx].ground_truth,
      confidence: 1.0,
      full_probs: null,
      task_category: "asr",
      eval_date: today,
      confidence_available: false,
    };
    predictionsByVendor[cr.vendor].push(pred);
  }

  // Run calibration per vendor (overall)
  const vendorsOutput: Record<string, {
    overall: { ece: number; mce: number; n_clips: number };
    by_group: Record<string, { ece: number; mce: number; n_clips: number }>;
  }> = {};

  for (const vendor of requestedVendors) {
    const preds = predictionsByVendor[vendor];

    // Overall calibration
    let overall = { ece: 0, mce: 0, n_clips: preds.length };
    if (preds.length > 0) {
      try {
        const report = runCalibration(vendor, preds, predictionsByVendor);
        overall = { ece: report.calibration.ece, mce: report.calibration.mce, n_clips: preds.length };
      } catch (err) {
        console.error(`[batch-calibration] ${vendor} overall failed:`, err);
      }
    }

    // By-group calibration
    const byGroup: Record<string, { ece: number; mce: number; n_clips: number }> = {};
    const groupedResults = new Map<string, { preds: PredictionRecord[]; count: number }>();

    for (const cr of clipResults) {
      if (cr.vendor !== vendor || cr.transcript === null) continue;
      const group = cr.speaker_group;
      if (!groupedResults.has(group)) {
        groupedResults.set(group, { preds: [], count: 0 });
      }
      const g = groupedResults.get(group)!;
      g.count++;
    }

    // Map clip results back to predictions for grouping
    for (let i = 0; i < clipResults.length; i++) {
      const cr = clipResults[i];
      if (cr.vendor !== vendor || cr.transcript === null) continue;
      const clipIdx = Math.floor(i / requestedVendors.length);
      const pred: PredictionRecord = {
        example_id: `${eval_id}-clip-${clipIdx}`,
        vendor_id: cr.vendor,
        predicted_label: cr.transcript.trim(),
        ground_truth_label: clips[clipIdx].ground_truth,
        confidence: 1.0,
        full_probs: null,
        task_category: "asr",
        eval_date: today,
        confidence_available: false,
      };
      const group = cr.speaker_group;
      if (!groupedResults.has(group)) {
        groupedResults.set(group, { preds: [], count: 0 });
      }
      groupedResults.get(group)!.preds.push(pred);
    }

    for (const [group, { preds: groupPreds }] of groupedResults) {
      if (groupPreds.length === 0) {
        byGroup[group] = { ece: 0, mce: 0, n_clips: 0 };
        continue;
      }
      try {
        const groupAllPreds: Record<string, PredictionRecord[]> = { [vendor]: groupPreds };
        const report = runCalibration(vendor, groupPreds, groupAllPreds);
        byGroup[group] = { ece: report.calibration.ece, mce: report.calibration.mce, n_clips: groupPreds.length };
      } catch (err) {
        console.error(`[batch-calibration] ${vendor}/${group} failed:`, err);
        byGroup[group] = { ece: 0, mce: 0, n_clips: groupPreds.length };
      }
    }

    vendorsOutput[vendor] = { overall, by_group: byGroup };
  }

  const evalResult = {
    eval_id,
    n_clips: clips.length,
    vendors: vendorsOutput,
  };

  await kv.set(`eval:batch:${eval_id}`, evalResult);

  return corsJson(evalResult);
}
