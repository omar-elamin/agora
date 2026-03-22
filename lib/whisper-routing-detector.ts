/**
 * Whisper Language-Routing Failure Detector
 *
 * Detects clips where Whisper routes to the wrong language (L1 instead of English),
 * producing catastrophic WER. These failures are invisible to confidence calibration
 * (T=4.0 temperature scaling) because the logprobs reflect L1 transcription quality,
 * not English accuracy.
 *
 * Detection signals (from Whisper verbose_json output):
 *   - language: detected language code
 *   - language_probability: Whisper's confidence in detected language (0-1, from softmax over language tokens)
 *   - avg_logprob: mean log probability of decoded tokens
 *
 * Thresholds derived from CV analysis (n=183, 2026-03-19):
 *   - Known routing failure: Spanish clip with WER > 1.0, language != 'en'
 *   - Soft signal: avg_logprob < -1.0 AND language_probability < 0.85 correlates
 *     with uncertain language detection — even if language == 'en', these clips
 *     are at elevated risk of partial L1 routing within segments
 */

// --- Types ---

export interface WhisperVerboseSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface WhisperVerboseOutput {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: WhisperVerboseSegment[];
}

export interface RoutingFailureResult {
  /** Whether a routing failure was detected */
  is_routing_failure: boolean;
  /** Severity: 'hard' = definite wrong language, 'soft' = uncertain/risky, 'none' = clean */
  severity: "hard" | "soft" | "none";
  /** Detected language code from Whisper */
  detected_language: string;
  /** Whisper's language detection confidence */
  language_probability: number;
  /** Mean avg_logprob across all segments */
  mean_avg_logprob: number;
  /** Human-readable reason for the flag */
  reason: string | null;
  /** Number of segments with individually poor logprobs */
  flagged_segments: number;
  /** Total segments analyzed */
  total_segments: number;
}

// --- Language Normalization ---

/**
 * Map of Whisper full language names to ISO 639-1 codes.
 * Whisper sometimes returns "English" instead of "en" depending on the API endpoint/version.
 */
const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  portuguese: "pt",
  italian: "it",
  dutch: "nl",
  russian: "ru",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
  arabic: "ar",
  hindi: "hi",
  turkish: "tr",
  polish: "pl",
  swedish: "sv",
  danish: "da",
  norwegian: "no",
  finnish: "fi",
};

/**
 * Normalize a Whisper language string to a lowercase ISO 639-1 code.
 * Handles cases where Whisper returns the full name ("English") instead of the code ("en").
 */
function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase().trim();
  return LANGUAGE_NAME_TO_CODE[lower] ?? lower;
}

// --- Thresholds ---

/** If language != 'en', it's a hard routing failure regardless of other signals */
const EXPECTED_LANGUAGE = "en";

/**
 * Soft failure thresholds — clips where language == 'en' but detection was uncertain.
 * Derived from CV data: the excluded Spanish routing failure had avg_logprob ~ -0.8
 * and language_probability well below 0.85. We use these as the boundary for "risky".
 */
const SOFT_AVG_LOGPROB_THRESHOLD = -1.0;
const SOFT_LANG_PROB_THRESHOLD = 0.85;

/**
 * Per-segment logprob threshold for flagging individual bad segments.
 * Segments below this are likely hallucinated or L1-routed.
 */
const SEGMENT_LOGPROB_THRESHOLD = -1.2;

// --- Core Detection ---

/**
 * Analyze Whisper verbose_json output for language-routing failures.
 *
 * Call this BEFORE emitting confidence scores. If is_routing_failure is true,
 * the clip's confidence score should not be trusted — flag it for manual review
 * or re-transcription with explicit language forcing.
 *
 * @param output - Whisper verbose_json response (must include language field)
 * @param languageProbability - language detection probability from Whisper
 *   (available in Groq/OpenAI verbose_json as top-level field, not always in segments)
 * @param expectedLanguage - expected language code (default: 'en')
 */
export function detectRoutingFailure(
  output: WhisperVerboseOutput,
  languageProbability: number,
  expectedLanguage: string = EXPECTED_LANGUAGE
): RoutingFailureResult {
  const detectedLanguage = normalizeLanguage(output.language);
  const segments = output.segments ?? [];

  // Compute mean avg_logprob across segments
  const meanAvgLogprob =
    segments.length > 0
      ? segments.reduce((sum, s) => sum + s.avg_logprob, 0) / segments.length
      : 0;

  // Count individually flagged segments
  const flaggedSegments = segments.filter(
    (s) => s.avg_logprob < SEGMENT_LOGPROB_THRESHOLD
  ).length;

  // Hard failure: wrong language detected
  if (detectedLanguage !== expectedLanguage) {
    return {
      is_routing_failure: true,
      severity: "hard",
      detected_language: detectedLanguage,
      language_probability: languageProbability,
      mean_avg_logprob: meanAvgLogprob,
      reason: `Whisper detected language '${detectedLanguage}' (expected '${expectedLanguage}') with probability ${languageProbability.toFixed(3)}`,
      flagged_segments: flaggedSegments,
      total_segments: segments.length,
    };
  }

  // Soft failure: language is 'en' but detection was uncertain + poor logprobs
  if (
    meanAvgLogprob < SOFT_AVG_LOGPROB_THRESHOLD &&
    languageProbability < SOFT_LANG_PROB_THRESHOLD
  ) {
    return {
      is_routing_failure: true,
      severity: "soft",
      detected_language: detectedLanguage,
      language_probability: languageProbability,
      mean_avg_logprob: meanAvgLogprob,
      reason: `Language detected as '${expectedLanguage}' but with low confidence (${languageProbability.toFixed(3)}) and poor avg_logprob (${meanAvgLogprob.toFixed(3)}) — elevated routing failure risk`,
      flagged_segments: flaggedSegments,
      total_segments: segments.length,
    };
  }

  // Clean
  return {
    is_routing_failure: false,
    severity: "none",
    detected_language: detectedLanguage,
    language_probability: languageProbability,
    mean_avg_logprob: meanAvgLogprob,
    reason: null,
    flagged_segments: flaggedSegments,
    total_segments: segments.length,
  };
}

/**
 * Quick boolean check — use in pipelines where you just need pass/fail.
 */
export function isRoutingFailure(
  output: WhisperVerboseOutput,
  languageProbability: number,
  expectedLanguage: string = EXPECTED_LANGUAGE
): boolean {
  return detectRoutingFailure(output, languageProbability, expectedLanguage)
    .is_routing_failure;
}
