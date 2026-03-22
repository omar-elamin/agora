/**
 * Route B post-processing: Whisper hallucination detector.
 *
 * Runs 5 independent heuristics on a transcript AFTER Whisper returns,
 * before downstream delivery.  Any single flag → quarantine.
 *
 * Spec: routing-layer-spec.md v1.1 addendum
 */

import type { WhisperResult } from "./whisper";

// ---------------------------------------------------------------------------
// Types & interfaces
// ---------------------------------------------------------------------------

export type HallucinationFlag =
  | "TOKEN_SPARSE"
  | "LANGUAGE_MISMATCH"
  | "KNOWN_HALLUCINATION_PHRASE"
  | "LOW_WORD_DENSITY"
  | "REPETITION_LOOP"
  | "EMPTY_OUTPUT";

export type Disposition = "QUARANTINE" | "PASS";

export interface QuarantineEvent {
  clip_id: string;
  ar_confidence: number;
  flags: HallucinationFlag[];
  transcript_snippet_50chars: string;
  audio_duration: number;
  word_count: number;
  wps: number;
  timestamp: string;
}

export interface DetectionResult {
  disposition: Disposition;
  flags: HallucinationFlag[];
  quarantine_event: QuarantineEvent | null;
}

export interface DetectAndQuarantineResult {
  result: WhisperResult;
  quarantined: boolean;
  flags: HallucinationFlag[];
  metrics: HallucinationMetrics;
}

export interface RetryConfig {
  initial_prompt: string;
  language: string;
}

// Monitoring metrics
export interface HallucinationMetrics {
  route_b_hallucination_rate: number;
  route_b_h3_phrase_rate: number;
  route_b_quarantine_volume: number;
  route_b_empty_output_rate: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const KNOWN_HALLUCINATION_PHRASES: string[] = [
  "اشتركوا في القناة",
  "اشترك في القناة",
  "للاشتراك في القناة",
  "شكراً لمشاهدتكم",
  "شكرا على المشاهدة",
  "Please subscribe",
  "Thanks for watching",
  "Like and subscribe",
  "Don't forget to subscribe",
  "الرجاء الاشتراك",
  "[موسيقى]",
  "[موسيقى هادئة]",
  "[صمت]",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

function countArabicChars(text: string): number {
  let count = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0600 && code <= 0x06ff) count++;
  }
  return count;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function computeNgramRepetitionRatio(words: string[], n: number): number {
  if (words.length < n) return 0;
  const ngrams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(" "));
  }
  const unique = new Set(ngrams);
  // ratio of repeated ngrams: 1 - (unique / total)
  return 1 - unique.size / ngrams.length;
}

// ---------------------------------------------------------------------------
// HallucinationDetector
// ---------------------------------------------------------------------------

export class HallucinationDetector {
  private totalChecked = 0;
  private totalQuarantined = 0;
  private totalH3 = 0;
  private totalEmpty = 0;

  /**
   * Run all 5 heuristics against a transcript.
   */
  detect(
    transcript: string,
    audio_duration_seconds: number,
    ar_confidence: number,
    clip_id: string = "unknown",
  ): DetectionResult {
    const flags: HallucinationFlag[] = [];
    const words = transcript.trim().length > 0 ? transcript.trim().split(/\s+/) : [];
    const word_count = words.length;
    const wps = audio_duration_seconds > 0 ? word_count / audio_duration_seconds : 0;
    const normalizedTranscript = normalize(transcript);

    // H1 – Token Sparsity
    if (audio_duration_seconds >= 5) {
      const expected_min = Math.floor((audio_duration_seconds / 60) * 80);
      if (word_count < expected_min * 0.4) {
        flags.push("TOKEN_SPARSE");
      }
    }

    // H2 – Language Mismatch
    const arabicChars = countArabicChars(transcript);
    const arabic_ratio = arabicChars / Math.max(transcript.length, 1);
    if (ar_confidence >= 0.85 && arabic_ratio < 0.05) {
      flags.push("LANGUAGE_MISMATCH");
    }

    // H3 – Known Hallucination Phrases + empty output
    if (transcript.trim().length === 0) {
      flags.push("EMPTY_OUTPUT");
      this.totalEmpty++;
    } else {
      for (const phrase of KNOWN_HALLUCINATION_PHRASES) {
        if (normalizedTranscript.includes(normalize(phrase))) {
          flags.push("KNOWN_HALLUCINATION_PHRASE");
          this.totalH3++;
          break;
        }
      }
    }

    // H4 – Low Word Density
    if (audio_duration_seconds >= 10) {
      if (wps < 0.4) {
        flags.push("LOW_WORD_DENSITY");
      }
    }

    // H5 – Repetition Loop
    if (words.length >= 10) {
      const ratio = computeNgramRepetitionRatio(words, 5);
      if (ratio > 0.5) {
        flags.push("REPETITION_LOOP");
      }
    }

    // Metrics bookkeeping
    this.totalChecked++;
    const quarantined = flags.length > 0;
    if (quarantined) this.totalQuarantined++;

    const disposition: Disposition = quarantined ? "QUARANTINE" : "PASS";
    const quarantine_event: QuarantineEvent | null = quarantined
      ? {
          clip_id,
          ar_confidence,
          flags,
          transcript_snippet_50chars: transcript.slice(0, 50),
          audio_duration: audio_duration_seconds,
          word_count,
          wps: parseFloat(wps.toFixed(3)),
          timestamp: new Date().toISOString(),
        }
      : null;

    return { disposition, flags, quarantine_event };
  }

  /**
   * Return a retry config with a prompt prefix for a quarantined clip.
   */
  retryWithPromptPrefix(clip: {
    language: string;
    ar_confidence: number;
  }): RetryConfig {
    const prefix =
      clip.ar_confidence >= 0.85
        ? "هذا تسجيل صوتي باللغة العربية. الرجاء النسخ بدقة."
        : "This is a voice recording. Please transcribe accurately.";
    return {
      initial_prompt: prefix,
      language: clip.language,
    };
  }

  /**
   * Current monitoring metrics snapshot.
   */
  getMetrics(): HallucinationMetrics {
    const total = Math.max(this.totalChecked, 1);
    return {
      route_b_hallucination_rate: this.totalQuarantined / total,
      route_b_h3_phrase_rate: this.totalH3 / total,
      route_b_quarantine_volume: this.totalQuarantined,
      route_b_empty_output_rate: this.totalEmpty / total,
    };
  }
}

// ---------------------------------------------------------------------------
// Integration wrapper
// ---------------------------------------------------------------------------

/**
 * Run hallucination detection on a WhisperResult.
 *
 * Returns the original result alongside quarantine status, flags, and metrics.
 */
export function detectAndQuarantine(
  whisperResult: WhisperResult,
  ar_confidence: number,
  clip_id: string = "unknown",
  detector: HallucinationDetector = new HallucinationDetector(),
): DetectAndQuarantineResult {
  const detection = detector.detect(
    whisperResult.transcript,
    whisperResult.duration_seconds,
    ar_confidence,
    clip_id,
  );

  return {
    result: whisperResult,
    quarantined: detection.disposition === "QUARANTINE",
    flags: detection.flags,
    metrics: detector.getMetrics(),
  };
}
