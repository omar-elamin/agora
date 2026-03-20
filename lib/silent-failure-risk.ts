import type { SilentFailureRisk } from "@/app/types/cqs";

export interface EvalResultForRisk {
  vendor: string;
  wer: number | null;
  routing_failure: boolean;
  routing_failure_reason: string | null;
}

export function computeSilentFailureRisk(result: EvalResultForRisk): SilentFailureRisk {
  const { vendor, routing_failure } = result;

  if (vendor === "deepgram") {
    return {
      rating: "MEDIUM",
      calibration_direction: "overconfident_mild",
      confidence_at_failure: null,
      recommended_threshold_guard: 0.92,
      rationale: "Mild overconfidence on East Asian accents. Tune confidence threshold to 0.90-0.92 for non-English user bases. No catastrophic failures observed in East Asian testing (n=170).",
    };
  }

  if (vendor === "whisper-large-v3") {
    return {
      rating: "LOW",
      calibration_direction: "underconfident",
      confidence_at_failure: null,
      recommended_threshold_guard: null,
      rationale: "Underconfident calibration: errors surface as low-confidence flags rather than passing silently. Failure mode is over-routing to human review (cost), not silent quality failures (compliance risk). Word-level confidence requires self-hosted inference — Groq API variant has no per-word signal.",
    };
  }

  if (vendor === "assemblyai_universal2" || vendor === "assemblyai") {
    if (routing_failure) {
      return {
        rating: "CRITICAL",
        calibration_direction: "overconfident_dangerous",
        confidence_at_failure: { min: 0.42, max: 0.75 },
        recommended_threshold_guard: 0.80,
        rationale: "~18% catastrophic failure rate on Japanese and Korean (language detection misfires → wrong-language output). Without a 0.80 confidence floor, these failures pass silently at standard threshold 0.95. The guard threshold is brittle: one observed case at conf=0.75 with WER=148%.",
      };
    }
    return {
      rating: "MEDIUM",
      calibration_direction: "overconfident_mild",
      confidence_at_failure: { min: 0.42, max: 0.75 },
      recommended_threshold_guard: 0.80,
      rationale: "Well-calibrated on normal clips but collapses on JA/KO catastrophic failures (conf drops to 0.42-0.75). Standard threshold 0.95 catches none of the observed failures. Recommended guard: 0.80 floor. This specific clip did not trigger a routing failure.",
    };
  }

  return {
    rating: "HIGH",
    calibration_direction: "unavailable",
    confidence_at_failure: null,
    recommended_threshold_guard: null,
    rationale: "Unknown vendor — calibration data unavailable. Treat as HIGH risk until evaluated.",
  };
}
