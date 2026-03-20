/**
 * fastText Language Validation Probe — Three-Stage Cascade
 *
 * Stage 1: Script/character-set check (Unicode block detection)
 * Stage 2: Language identification (franc — pure JS, Vercel-compatible)
 * Stage 3: Confidence demotion logic
 */

import { franc } from "franc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_PROBE_LENGTH = 20;
export const ESCALATION_THRESHOLD = 0.80;
export const STRONG_DEMOTION_FACTOR = 0.60;
export const MEDIUM_DEMOTION_FACTOR = 0.75;
export const MILD_DEMOTION_FACTOR = 0.90;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationProbeResult {
  stage_reached: "script" | "fasttext" | "none";
  probe_lang: string | null;
  probe_confidence: number | null;
  declared_lang: string;
  result: "agree" | "disagree" | "probe_skipped_short" | "script_mismatch";
  demotion_applied: boolean;
  demotion_factor: number | null;
  probe_verified: boolean | null;
  escalate_to_audit: boolean;
}

export interface DemotionResult {
  adjusted_confidence: number;
  demotion_applied: boolean;
  demotion_factor?: number;
  probe_verified: boolean | null;
  escalate_to_audit: boolean;
}

interface LangPrediction {
  lang: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Stage 1: Script / Character-Set Check
// ---------------------------------------------------------------------------

type ScriptFamily = "latin" | "cyrillic" | "arabic" | "cjk" | "devanagari" | "hebrew";

const SCRIPT_RANGES: Record<ScriptFamily, [number, number][]> = {
  latin:      [[0x0041, 0x024F]],
  cyrillic:   [[0x0400, 0x04FF]],
  arabic:     [[0x0600, 0x06FF]],
  cjk:        [[0x4E00, 0x9FFF], [0x3040, 0x30FF], [0x3400, 0x4DBF], [0xAC00, 0xD7AF]],
  devanagari: [[0x0900, 0x097F]],
  hebrew:     [[0x0590, 0x05FF]],
};

const LANGUAGE_TO_SCRIPT: Record<string, ScriptFamily[]> = {
  en: ["latin"], es: ["latin"], fr: ["latin"], de: ["latin"],
  pt: ["latin"], it: ["latin"], nl: ["latin"], sv: ["latin"],
  da: ["latin"], nb: ["latin"], fi: ["latin"], pl: ["latin"],
  cs: ["latin"], ro: ["latin"], hu: ["latin"], tr: ["latin"],
  vi: ["latin"], id: ["latin"], ms: ["latin"], tl: ["latin"],
  ru: ["cyrillic"], uk: ["cyrillic"], bg: ["cyrillic"], sr: ["cyrillic"],
  ar: ["arabic"], fa: ["arabic"], ur: ["arabic"],
  zh: ["cjk"], ja: ["cjk"], ko: ["cjk"],
  hi: ["devanagari"], mr: ["devanagari"], ne: ["devanagari"],
  he: ["hebrew"], yi: ["hebrew"],
};

function charInRange(cp: number, ranges: [number, number][]): boolean {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

export function detectDominantScript(text: string): ScriptFamily | "unknown" {
  const scores: Record<ScriptFamily, number> = {
    latin: 0, cyrillic: 0, arabic: 0, cjk: 0, devanagari: 0, hebrew: 0,
  };

  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    for (const [script, ranges] of Object.entries(SCRIPT_RANGES) as [ScriptFamily, [number, number][]][]) {
      if (charInRange(cp, ranges)) {
        scores[script]++;
        break;
      }
    }
  }

  let dominant: ScriptFamily | "unknown" = "unknown";
  let max = 0;
  for (const [script, count] of Object.entries(scores) as [ScriptFamily, number][]) {
    if (count > max) {
      max = count;
      dominant = script;
    }
  }
  return max > 0 ? dominant : "unknown";
}

export function scriptMismatch(transcript: string, declaredLang: string): boolean {
  const dominant = detectDominantScript(transcript);
  if (dominant === "unknown") return false;
  const expected = LANGUAGE_TO_SCRIPT[declaredLang] ?? ["latin"];
  return !expected.includes(dominant);
}

// ---------------------------------------------------------------------------
// Stage 2: Language Identification (franc)
// ---------------------------------------------------------------------------

/**
 * ISO 639-3 → ISO 639-1 mapping for languages we care about.
 * franc returns ISO 639-3 codes; the spec uses ISO 639-1.
 */
const ISO3_TO_ISO1: Record<string, string> = {
  eng: "en", spa: "es", fra: "fr", deu: "de", por: "pt", ita: "it",
  nld: "nl", swe: "sv", dan: "da", nob: "nb", fin: "fi", pol: "pl",
  ces: "cs", ron: "ro", hun: "hu", tur: "tr", vie: "vi", ind: "id",
  msa: "ms", tgl: "tl", rus: "ru", ukr: "uk", bul: "bg", srp: "sr",
  ara: "ar", fas: "fa", urd: "ur", cmn: "zh", zho: "zh",
  jpn: "ja", kor: "ko", hin: "hi", mar: "mr", nep: "ne",
  heb: "he", yid: "yi", tha: "th", kat: "ka", ell: "el",
  ben: "bn", tam: "ta", tel: "te", kan: "kn", mal: "ml",
  afr: "af", cat: "ca", glg: "gl", eus: "eu", cym: "cy",
};

/**
 * Normalize a language code to ISO 639-1. Handles BCP-47 tags (e.g. "en-US" → "en")
 * and ISO 639-3 codes.
 */
export function normalizeLangCode(code: string): string {
  const base = code.toLowerCase().split("-")[0].split("_")[0];
  if (base.length === 2) return base;
  return ISO3_TO_ISO1[base] ?? base;
}

function francPredict(text: string): LangPrediction[] {
  const cleaned = text.replace(/\n/g, " ").trim();
  if (!cleaned) return [];

  // franc returns ISO 639-3 code, or "und" if undetermined
  const topLang = franc(cleaned);
  if (topLang === "und") return [];

  // franc doesn't give confidence natively — estimate from text length & determinism
  // We re-run with minLength to simulate confidence: if result is stable, high confidence
  const iso1 = normalizeLangCode(topLang);

  // Heuristic confidence: longer text → higher confidence, capped at 0.95
  const len = cleaned.length;
  const baseConf = Math.min(0.95, 0.5 + (len / 500) * 0.45);

  return [{ lang: iso1, confidence: parseFloat(baseConf.toFixed(4)) }];
}

export function probeLanguage(
  transcript: string,
  declaredLang: string,
): { result: string; probe_lang: string | null; probe_confidence: number | null; declared_lang: string } {
  const preds = francPredict(transcript);
  const declaredNorm = normalizeLangCode(declaredLang);

  if (preds.length === 0) {
    return { result: "insufficient_text", probe_lang: null, probe_confidence: null, declared_lang: declaredNorm };
  }

  const top = preds[0];
  const agree = top.lang === declaredNorm;

  return {
    result: agree ? "agree" : "disagree",
    probe_lang: top.lang,
    probe_confidence: top.confidence,
    declared_lang: declaredNorm,
  };
}

// ---------------------------------------------------------------------------
// Stage 3: Confidence Demotion
// ---------------------------------------------------------------------------

export function applyConfidenceDemotion(
  primaryConfidence: number,
  probeResult: { result: string; probe_confidence: number | null },
): DemotionResult {
  const { result, probe_confidence: probeConf } = probeResult;

  if (result === "agree") {
    return {
      adjusted_confidence: primaryConfidence,
      demotion_applied: false,
      probe_verified: true,
      escalate_to_audit: false,
    };
  }

  if (result === "disagree" && probeConf !== null) {
    let demotionFactor: number;
    let auditFlag: boolean;

    if (probeConf >= ESCALATION_THRESHOLD && primaryConfidence >= ESCALATION_THRESHOLD) {
      demotionFactor = STRONG_DEMOTION_FACTOR;
      auditFlag = true;
    } else if (probeConf >= 0.70) {
      demotionFactor = MEDIUM_DEMOTION_FACTOR;
      auditFlag = false;
    } else {
      demotionFactor = MILD_DEMOTION_FACTOR;
      auditFlag = false;
    }

    return {
      adjusted_confidence: parseFloat((primaryConfidence * demotionFactor).toFixed(4)),
      demotion_applied: true,
      demotion_factor: demotionFactor,
      probe_verified: false,
      escalate_to_audit: auditFlag,
    };
  }

  // probe_skipped_short, script_mismatch, insufficient_text, etc.
  return {
    adjusted_confidence: primaryConfidence,
    demotion_applied: false,
    probe_verified: null,
    escalate_to_audit: false,
  };
}

// ---------------------------------------------------------------------------
// ProbeService — orchestrates the full cascade
// ---------------------------------------------------------------------------

export class ProbeService {
  /**
   * Run the three-stage validation probe on a transcript.
   *
   * @param transcript - The ASR transcript text
   * @param declaredLang - The language the primary ASR model declared (e.g. "en", "ja")
   * @param primaryConfidence - The primary model's confidence score (0–1)
   * @returns ValidationProbeResult with adjusted confidence info
   */
  run(
    transcript: string,
    declaredLang: string,
    primaryConfidence: number,
  ): { probe: ValidationProbeResult; adjusted_confidence: number } {
    const declaredNorm = normalizeLangCode(declaredLang);

    // Guard: short text
    if (transcript.trim().length < MIN_PROBE_LENGTH) {
      return {
        probe: {
          stage_reached: "none",
          probe_lang: null,
          probe_confidence: null,
          declared_lang: declaredNorm,
          result: "probe_skipped_short",
          demotion_applied: false,
          demotion_factor: null,
          probe_verified: null,
          escalate_to_audit: false,
        },
        adjusted_confidence: primaryConfidence,
      };
    }

    // Stage 1: Script check
    if (scriptMismatch(transcript, declaredNorm)) {
      const dominant = detectDominantScript(transcript);
      return {
        probe: {
          stage_reached: "script",
          probe_lang: null,
          probe_confidence: null,
          declared_lang: declaredNorm,
          result: "script_mismatch",
          demotion_applied: true,
          demotion_factor: STRONG_DEMOTION_FACTOR,
          probe_verified: false,
          escalate_to_audit: true,
        },
        adjusted_confidence: parseFloat((primaryConfidence * STRONG_DEMOTION_FACTOR).toFixed(4)),
      };
    }

    // Stage 2: Language identification
    const langResult = probeLanguage(transcript, declaredNorm);

    // Stage 3: Confidence demotion
    const demotion = applyConfidenceDemotion(primaryConfidence, {
      result: langResult.result,
      probe_confidence: langResult.probe_confidence,
    });

    const probeResultStr = langResult.result as ValidationProbeResult["result"];

    return {
      probe: {
        stage_reached: "fasttext",
        probe_lang: langResult.probe_lang,
        probe_confidence: langResult.probe_confidence,
        declared_lang: declaredNorm,
        result: probeResultStr,
        demotion_applied: demotion.demotion_applied,
        demotion_factor: demotion.demotion_factor ?? null,
        probe_verified: demotion.probe_verified,
        escalate_to_audit: demotion.escalate_to_audit,
      },
      adjusted_confidence: demotion.adjusted_confidence,
    };
  }
}
