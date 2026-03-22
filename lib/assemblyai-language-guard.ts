/**
 * AssemblyAI language_code routing guard.
 *
 * When AssemblyAI's paired fallback (universal-3-pro → universal-2) processes
 * audio from non-English native speakers, it can return a non-English
 * language_code with 100% WER — transcribing in the wrong language entirely.
 * Deepgram Nova-3 handles these cases correctly (Arabic 1.5% WER, Korean 14.5% WER).
 *
 * This guard detects the language_code routing failure and recommends rerouting
 * to Deepgram Nova-3 as the recovery vendor.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Language codes where AssemblyAI has been observed to fail with 100% WER. */
export const ASSEMBLYAI_FAILING_LANGUAGES: readonly string[] = ["ar", "ko", "ja"];

/** Language codes that indicate English output (no routing failure). */
export const ENGLISH_LANGUAGE_CODES: readonly string[] = ["en", "en_us", "en-us"];

const ASSEMBLYAI_VENDORS = new Set(["assemblyai", "assemblyai_universal2"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LanguageRoutingInput {
  vendor: string;
  language_code?: string | null;
  transcript?: string | null;
}

export interface LanguageRoutingResult {
  is_failure: boolean;
  detected_language: string | null;
  recommended_vendor: string | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

export function detectLanguageRoutingFailure(
  vendorResult: LanguageRoutingInput,
): LanguageRoutingResult {
  const { vendor, language_code } = vendorResult;

  if (!ASSEMBLYAI_VENDORS.has(vendor)) {
    return {
      is_failure: false,
      detected_language: null,
      recommended_vendor: null,
      reason: "Not an AssemblyAI vendor — guard does not apply.",
    };
  }

  if (language_code == null || language_code === "") {
    return {
      is_failure: false,
      detected_language: null,
      recommended_vendor: null,
      reason: "No language_code returned — cannot determine routing failure.",
    };
  }

  const normalized = language_code.toLowerCase().trim();

  if (ENGLISH_LANGUAGE_CODES.includes(normalized)) {
    return {
      is_failure: false,
      detected_language: normalized,
      recommended_vendor: null,
      reason: "Language code indicates English output — no routing failure.",
    };
  }

  const isKnownFailing = ASSEMBLYAI_FAILING_LANGUAGES.includes(normalized);

  return {
    is_failure: true,
    detected_language: normalized,
    recommended_vendor: "deepgram_nova3",
    reason: isKnownFailing
      ? `AssemblyAI returned language_code='${normalized}', a known-failing language (100% WER observed). Route to Deepgram Nova-3 for recovery.`
      : `AssemblyAI returned non-English language_code='${normalized}'. Potential language detection failure — route to Deepgram Nova-3 for recovery.`,
  };
}
