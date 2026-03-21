export const KOREAN_CONFIDENCE_THRESHOLD = 0.964;

export interface KoreanRoutingResult {
  should_route_to_backup: boolean;
  confidence: number | null;
  language: string | null;
  threshold: number;
  reason: string | null;
}

export function evaluateKoreanRouting(
  confidence: number | null,
  detectedLanguage: string | null
): KoreanRoutingResult {
  const base = {
    confidence,
    language: detectedLanguage,
    threshold: KOREAN_CONFIDENCE_THRESHOLD,
  };

  if (detectedLanguage !== "ko") {
    return { ...base, should_route_to_backup: false, reason: null };
  }

  if (confidence === null) {
    return {
      ...base,
      should_route_to_backup: false,
      reason: "no confidence data",
    };
  }

  if (confidence < KOREAN_CONFIDENCE_THRESHOLD) {
    return {
      ...base,
      should_route_to_backup: true,
      reason: `Korean confidence ${confidence} below threshold ${KOREAN_CONFIDENCE_THRESHOLD}`,
    };
  }

  return { ...base, should_route_to_backup: false, reason: null };
}
