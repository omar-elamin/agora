import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/auth";
import { transcribe as deepgramTranscribe } from "@/lib/deepgram";
import { transcribe as whisperTranscribe } from "@/lib/whisper";
import { kv } from "@/lib/kv";
import { corsJson, corsOptions } from "@/lib/cors";
import { detectRoutingFailure } from "@/lib/whisper-routing-detector";
import type { WhisperVerboseOutput } from "@/lib/whisper-routing-detector";
import { computeSilentFailureRisk } from "@/lib/silent-failure-risk";
import { computeDeploymentGuards } from "@/lib/deployment-guards";
import { runCalibration } from "@/lib/calibration";
import type {
  PredictionRecord,
  CalibrationResult,
  FDSResult,
  TrustScoreResult,
} from "@/lib/calibration-types";
import { ProbeService } from "@/lib/probe-service";
import type { ValidationProbeResult } from "@/lib/probe-service";
import crypto from "crypto";

const probeService = new ProbeService();

const SUPPORTED_VENDORS = ["deepgram", "whisper-large-v3"] as const;
type Vendor = (typeof SUPPORTED_VENDORS)[number];

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
  const { audio_url, ground_truth, vendors } = body as {
    audio_url: string;
    ground_truth?: string;
    vendors?: string[];
  };

  if (!audio_url) {
    return corsJson({ error: "audio_url is required" }, { status: 400 });
  }

  // Default to deepgram only for backward compat; accept vendors array
  const requestedVendors: Vendor[] = vendors
    ? (vendors.filter((v) => SUPPORTED_VENDORS.includes(v as Vendor)) as Vendor[])
    : ["deepgram"];

  if (requestedVendors.length === 0) {
    return corsJson(
      {
        error: `No valid vendors specified. Supported: ${SUPPORTED_VENDORS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const submitted_at = new Date().toISOString();

  // Run all vendors in parallel
  const vendorResults = await Promise.allSettled(
    requestedVendors.map(async (vendor) => {
      if (vendor === "deepgram") {
        const result = await deepgramTranscribe(audio_url);
        return { vendor, ...result };
      } else if (vendor === "whisper-large-v3") {
        const result = await whisperTranscribe(audio_url);
        return { vendor, ...result };
      }
      throw new Error(`Unknown vendor: ${vendor}`);
    })
  );

  const completed_at = new Date().toISOString();

  const results = vendorResults
    .map((r, i) => {
      const vendor = requestedVendors[i];
      if (r.status === "fulfilled") {
        let { transcript, latency_ms, cost_usd, duration_seconds } = r.value;
        const wer =
          ground_truth !== undefined
            ? computeWER(transcript, ground_truth)
            : null;

        let routing_failure = false;
        let routing_failure_reason: string | null = null;

        // Use verbose_json routing detection for Whisper results
        if (vendor === "whisper-large-v3" && "segments" in r.value && r.value.segments.length > 0) {
          const verboseOutput: WhisperVerboseOutput = {
            task: "transcribe",
            language: r.value.language,
            duration: duration_seconds,
            text: transcript,
            segments: r.value.segments,
          };
          const detection = detectRoutingFailure(verboseOutput, r.value.language_probability);
          if (detection.is_routing_failure) {
            routing_failure = true;
            routing_failure_reason = detection.reason;
            if (detection.severity === "hard") {
              transcript = "transcription failed: wrong language detected";
            }
          }
        }

        // WER>1.0 fallback when verbose data is missing
        if (!routing_failure && wer !== null && wer > 1.0) {
          routing_failure = true;
          routing_failure_reason = `WER ${wer.toFixed(4)} exceeds 1.0 — likely routing failure`;
        }

        const silent_failure_risk = computeSilentFailureRisk({ vendor, wer, routing_failure, routing_failure_reason });
        const deployment_guards = computeDeploymentGuards(vendor);

        // Run language validation probe
        let validation_probe: ValidationProbeResult | null = null;
        let adjusted_confidence: number | null = null;
        const declaredLang = ("language" in r.value && typeof r.value.language === "string")
          ? r.value.language
          : "en";
        const primaryConfidence = ("language_probability" in r.value && typeof r.value.language_probability === "number")
          ? r.value.language_probability
          : null;

        if (transcript && primaryConfidence !== null) {
          const probeOut = probeService.run(transcript, declaredLang, primaryConfidence);
          validation_probe = probeOut.probe;
          adjusted_confidence = probeOut.adjusted_confidence;
        }

        return { vendor, transcript, latency_ms, cost_usd, duration_seconds, wer, routing_failure, routing_failure_reason, silent_failure_risk, deployment_guards, validation_probe, adjusted_confidence, primary_confidence: primaryConfidence, error: null };
      } else {
        return {
          vendor,
          transcript: null,
          latency_ms: null,
          cost_usd: null,
          duration_seconds: null,
          wer: null,
          routing_failure: false,
          routing_failure_reason: null,
          silent_failure_risk: null,
          deployment_guards: [],
          validation_probe: null,
          adjusted_confidence: null,
          primary_confidence: null,
          error: r.reason?.message ?? "Unknown error",
        };
      }
    });

  // Rank by WER (lower is better), then latency
  const ranked = [...results]
    .filter((r) => r.transcript !== null && !r.routing_failure)
    .sort((a, b) => {
      if (a.wer !== null && b.wer !== null) return a.wer - b.wer;
      if (a.wer !== null) return -1;
      if (b.wer !== null) return 1;
      return (a.latency_ms ?? Infinity) - (b.latency_ms ?? Infinity);
    });

  const rankedResults = results.map((r) => ({
    ...r,
    rank: ranked.findIndex((rr) => rr.vendor === r.vendor) + 1 || null,
  }));

  // --- Calibration pipeline ---
  const today = new Date().toISOString().slice(0, 10);
  const eval_id_cal = crypto.randomUUID();

  // Build PredictionRecords for vendors that have a transcript and ground_truth
  const allPredictions: Record<string, PredictionRecord[]> = {};
  if (ground_truth) {
    for (const r of rankedResults) {
      if (r.transcript) {
        const hasConfidence = r.vendor === "deepgram" && "confidence" in r && r.confidence !== null;
        const pred: PredictionRecord = {
          example_id: eval_id_cal,
          vendor_id: r.vendor,
          predicted_label: r.transcript.trim(),
          ground_truth_label: ground_truth,
          confidence: hasConfidence ? (r as { confidence: number }).confidence : 1.0,
          full_probs: null,
          task_category: "asr",
          eval_date: today,
          confidence_available: hasConfidence,
        };
        allPredictions[r.vendor] = [pred];
      }
    }
  }

  // Run calibration per vendor, attach results
  const calibratedResults = rankedResults.map((r) => {
    let calibration_result: CalibrationResult | null = null;
    let fds_result: FDSResult | null = null;
    let trust_score_result: TrustScoreResult | null = null;
    let reliability_diagram_url: string | null = null;

    if (ground_truth && r.transcript && allPredictions[r.vendor]) {
      try {
        const report = runCalibration(
          r.vendor,
          allPredictions[r.vendor],
          allPredictions,
        );
        calibration_result = report.calibration;
        fds_result = report.fds;
        trust_score_result = report.trust_score;
        reliability_diagram_url = `/calibration-output/vendors/${r.vendor}/calibration/asr/reliability-${today}.svg`;
      } catch (err) {
        console.error(`[calibration] ${r.vendor} failed:`, err);
      }
    }

    return {
      ...r,
      calibration_result,
      fds_result,
      trust_score_result,
      reliability_diagram_url,
    };
  });

  const bestAccuracy = ranked[0]?.vendor ?? requestedVendors[0];
  const bestSpeed = [...results]
    .filter((r) => r.latency_ms !== null)
    .sort((a, b) => (a.latency_ms ?? Infinity) - (b.latency_ms ?? Infinity))[0]?.vendor ?? requestedVendors[0];
  const bestCost = [...results]
    .filter((r) => r.cost_usd !== null)
    .sort((a, b) => (a.cost_usd ?? Infinity) - (b.cost_usd ?? Infinity))[0]?.vendor ?? requestedVendors[0];

  const eval_id = eval_id_cal;

  const evalResult = {
    eval_id,
    status: "complete" as const,
    submitted_at,
    completed_at,
    vendors_requested: requestedVendors,
    results: calibratedResults,
    recommendation: {
      best_accuracy: bestAccuracy,
      best_speed: bestSpeed,
      best_cost: bestCost,
    },
  };

  await kv.set(`eval:${eval_id}`, evalResult);

  return corsJson(evalResult);
}
