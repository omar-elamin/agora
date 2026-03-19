// Whisper large-v3 via Groq API
// Groq offers Whisper large-v3 with generous free tier + low latency inference
// Signup: https://console.groq.com → create API key → add as GROQ_API_KEY in Vercel env

const GROQ_API_KEY = process.env.GROQ_API_KEY;
// Fallback to OpenAI if Groq not available
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Groq pricing: $0.111 / hour = ~$0.00185/min
// OpenAI pricing: $0.006/min
const GROQ_COST_PER_MINUTE_USD = 0.00185;
const OPENAI_COST_PER_MINUTE_USD = 0.006;

import type { WhisperVerboseSegment } from "./whisper-routing-detector";

export interface WhisperResult {
  transcript: string;
  duration_seconds: number;
  cost_usd: number;
  latency_ms: number;
  provider: "groq" | "openai";
  language: string;
  language_probability: number;
  segments: WhisperVerboseSegment[];
}

async function fetchAudioBlob(audioUrl: string): Promise<Blob> {
  const res = await fetch(audioUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio: ${res.status}`);
  }
  return res.blob();
}

export async function transcribe(audioUrl: string): Promise<WhisperResult> {
  if (GROQ_API_KEY) {
    return transcribeViaGroq(audioUrl);
  } else if (OPENAI_API_KEY) {
    return transcribeViaOpenAI(audioUrl);
  } else {
    throw new Error(
      "Whisper vendor requires GROQ_API_KEY or OPENAI_API_KEY environment variable. " +
        "Sign up at https://console.groq.com for a free Groq key."
    );
  }
}

async function transcribeViaGroq(audioUrl: string): Promise<WhisperResult> {
  const start = performance.now();

  const audioBlob = await fetchAudioBlob(audioUrl);

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.mp3");
  formData.append("model", "whisper-large-v3");
  formData.append("language", "en");
  formData.append("response_format", "verbose_json");

  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq Whisper API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const latency_ms = Math.round(performance.now() - start);

  const transcript = (data?.text ?? "") as string;
  const duration_seconds = (data?.duration ?? 0) as number;
  const cost_usd = parseFloat(
    ((duration_seconds / 60) * GROQ_COST_PER_MINUTE_USD).toFixed(6)
  );
  const language = (data?.language ?? "en") as string;
  const language_probability = (data?.language_probability ?? 1.0) as number;
  const segments = (data?.segments ?? []) as WhisperVerboseSegment[];

  return { transcript, duration_seconds, cost_usd, latency_ms, provider: "groq", language, language_probability, segments };
}

async function transcribeViaOpenAI(audioUrl: string): Promise<WhisperResult> {
  const start = performance.now();

  const audioBlob = await fetchAudioBlob(audioUrl);

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.mp3");
  formData.append("model", "whisper-1");
  formData.append("language", "en");
  formData.append("response_format", "verbose_json");

  const res = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI Whisper API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const latency_ms = Math.round(performance.now() - start);

  const transcript = (data?.text ?? "") as string;
  const duration_seconds = (data?.duration ?? 0) as number;
  const cost_usd = parseFloat(
    ((duration_seconds / 60) * OPENAI_COST_PER_MINUTE_USD).toFixed(6)
  );
  const language = (data?.language ?? "en") as string;
  const language_probability = (data?.language_probability ?? 1.0) as number;
  const segments = (data?.segments ?? []) as WhisperVerboseSegment[];

  return { transcript, duration_seconds, cost_usd, latency_ms, provider: "openai", language, language_probability, segments };
}
