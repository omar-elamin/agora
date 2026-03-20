import type { KnownBehavior } from "@/app/types/cqs";

const ASSEMBLYAI_BEHAVIORS: KnownBehavior[] = [
  {
    id: "aai-threshold-hard-fail",
    vendor: "assemblyai",
    severity: "critical",
    title: "language_confidence_threshold causes hard failures, not fallbacks",
    summary:
      "When set, jobs that fall below the threshold return status=error — no transcript, no partial result. Most integrations expect a fallback to English.",
    detail:
      "The entire transcription job fails with an error like: detected language ko, confidence 0.5883, is below the requested confidence threshold value of 0.80. Any code that only checks for status=completed will silently miss these failures. There is no usable output.",
    affected_params: ["language_confidence_threshold", "language_detection"],
    recommendation:
      "Leave language_confidence_threshold unset (default null). Check language_code post-hoc instead. If you must use it, explicitly handle status=error in your polling logic.",
  },
  {
    id: "aai-confidence-mismatch",
    vendor: "assemblyai",
    severity: "warning",
    title: "API confidence ≠ internal threshold confidence",
    summary:
      "The language_confidence value in the API response is consistently higher than the internal value used for threshold comparison. You cannot predict threshold behavior from observable API fields.",
    detail:
      "AssemblyAI computes an internal confidence score during language detection. The threshold fires against this internal value, but the API surfaces a different, higher number. Gaps of 0.04–0.17 observed across test clips. A buyer who reads language_confidence: 0.80 and sets threshold=0.79 may still get errors because the internal value was 0.76.",
    affected_params: [
      "language_confidence_threshold",
      "language_confidence",
    ],
    recommendation:
      "Do not calibrate your threshold based on API-reported language_confidence values. Use a conservative threshold (≤0.75) or avoid the parameter entirely.",
  },
];

export function getKnownBehaviors(vendor: string): KnownBehavior[] {
  if (vendor === "assemblyai") return ASSEMBLYAI_BEHAVIORS;
  return [];
}
