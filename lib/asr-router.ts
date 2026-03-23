import { detectLanguage } from "./assemblyai";
import { transcribe as whisperTranscribe } from "./whisper";

const AR_CONFIDENCE_THRESHOLD = 0.75;

export interface RoutingDecision {
  route: "A" | "B";
  model: "assemblyai" | "whisper";
  language_lock: string | null;
  ar_confidence: number | null;
  reason: string;
}

export interface RoutedTranscriptResult {
  transcript: string;
  duration_seconds: number;
  cost_usd: number;
  latency_ms: number;
  routing: RoutingDecision;
}

export async function routeAndTranscribe(
  audioUrl: string,
  callerType: "rep" | "prospect"
): Promise<RoutedTranscriptResult> {
  let routing: RoutingDecision;

  if (callerType === "rep") {
    routing = {
      route: "A",
      model: "whisper",
      language_lock: "en",
      ar_confidence: null,
      reason: "rep caller — forced English",
    };
  } else {
    // prospect: run language detection first
    let arConfidence: number;
    try {
      const detection = await detectLanguage(audioUrl);
      arConfidence =
        detection.detected_language === "ar" ? detection.language_confidence : 0;
    } catch (err) {
      console.warn("[asr-router] language detection failed, defaulting to Route B:", err);
      arConfidence = AR_CONFIDENCE_THRESHOLD; // triggers Route B as fallback
    }

    if (arConfidence >= AR_CONFIDENCE_THRESHOLD) {
      routing = {
        route: "B",
        model: "whisper",
        language_lock: null,
        ar_confidence: arConfidence,
        reason: `prospect ar_confidence=${arConfidence} >= ${AR_CONFIDENCE_THRESHOLD} — no language lock`,
      };
    } else {
      routing = {
        route: "A",
        model: "whisper",
        language_lock: "en",
        ar_confidence: arConfidence,
        reason: `prospect ar_confidence=${arConfidence} < ${AR_CONFIDENCE_THRESHOLD} — forced English`,
      };
    }
  }

  console.log(
    `[asr-router] route=${routing.route} model=${routing.model} ar_confidence=${routing.ar_confidence}`
  );

  const whisperResult = await whisperTranscribe(
    audioUrl,
    routing.language_lock ? { language: routing.language_lock } : undefined
  );

  return {
    transcript: whisperResult.transcript,
    duration_seconds: whisperResult.duration_seconds,
    cost_usd: whisperResult.cost_usd,
    latency_ms: whisperResult.latency_ms,
    routing,
  };
}
