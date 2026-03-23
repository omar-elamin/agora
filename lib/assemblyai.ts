const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY!;
const COST_PER_MINUTE_USD = 0.0018; // Universal-2

const BASE_URL = "https://api.assemblyai.com";
const POLL_INTERVAL_MS = 2000;
const MAX_RETRIES = 60;

export interface AssemblyAIWord {
  text: string;
  confidence: number;
  start: number;
  end: number;
}

export interface AssemblyAIResult {
  transcript: string;
  duration_seconds: number;
  cost_usd: number;
  latency_ms: number;
  confidence: number | null;
  detected_language: string | null;
  words: AssemblyAIWord[];
  language_code: string | null;
}

export interface LanguageDetectionResult {
  detected_language: string;
  language_confidence: number;
}

export async function detectLanguage(audioUrl: string): Promise<LanguageDetectionResult> {
  const headers = {
    Authorization: ASSEMBLYAI_API_KEY,
    "Content-Type": "application/json",
  };

  const submitRes = await fetch(`${BASE_URL}/v2/transcript`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      audio_url: audioUrl,
      language_detection: true,
      speech_models: ["universal-2"],
    }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`AssemblyAI submit error ${submitRes.status}: ${body}`);
  }

  const submitData = await submitRes.json();
  const transcriptId: string = submitData.id;

  let pollData: Record<string, unknown> | null = null;
  for (let i = 0; i < MAX_RETRIES; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}`, {
      headers: { Authorization: ASSEMBLYAI_API_KEY },
    });

    if (!pollRes.ok) {
      const body = await pollRes.text();
      throw new Error(`AssemblyAI poll error ${pollRes.status}: ${body}`);
    }

    pollData = await pollRes.json();
    const status = pollData!.status as string;

    if (status === "completed") break;
    if (status === "error") {
      throw new Error(`AssemblyAI language detection failed: ${pollData!.error ?? "unknown error"}`);
    }
  }

  if (!pollData || (pollData.status as string) !== "completed") {
    throw new Error("AssemblyAI language detection timed out after max retries");
  }

  return {
    detected_language: (pollData.language_code as string) ?? "unknown",
    language_confidence: (pollData.language_confidence as number) ?? 0,
  };
}

export async function transcribe(audioUrl: string, options?: { language_code?: string }): Promise<AssemblyAIResult> {
  const start = performance.now();

  const headers = {
    Authorization: ASSEMBLYAI_API_KEY,
    "Content-Type": "application/json",
  };

  // Step 1: Submit transcription job
  const body: Record<string, unknown> = {
    audio_url: audioUrl,
    speech_models: ["universal-2"],
  };
  if (options?.language_code) {
    body.language_code = options.language_code;
  }

  const submitRes = await fetch(`${BASE_URL}/v2/transcript`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`AssemblyAI submit error ${submitRes.status}: ${body}`);
  }

  const submitData = await submitRes.json();
  const transcriptId: string = submitData.id;

  // Step 2: Poll until completed or error
  let pollData: Record<string, unknown> | null = null;
  for (let i = 0; i < MAX_RETRIES; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}`, {
      headers: { Authorization: ASSEMBLYAI_API_KEY },
    });

    if (!pollRes.ok) {
      const body = await pollRes.text();
      throw new Error(`AssemblyAI poll error ${pollRes.status}: ${body}`);
    }

    pollData = await pollRes.json();
    const status = pollData!.status as string;

    if (status === "completed") break;
    if (status === "error") {
      throw new Error(`AssemblyAI transcription failed: ${pollData!.error ?? "unknown error"}`);
    }
  }

  if (!pollData || (pollData.status as string) !== "completed") {
    throw new Error("AssemblyAI transcription timed out after max retries");
  }

  const latency_ms = Math.round(performance.now() - start);

  const transcript = (pollData.text as string) ?? "";
  const audio_duration = (pollData.audio_duration as number) ?? 0;
  const cost_usd = parseFloat(
    ((audio_duration / 60) * COST_PER_MINUTE_USD).toFixed(6)
  );

  const language_code: string | null = (pollData.language_code as string) ?? null;
  const detected_language: string | null = language_code;

  const rawWords: AssemblyAIWord[] = (
    (pollData.words as Array<{ text: string; confidence: number; start: number; end: number }>) ?? []
  ).map((w) => ({
    text: w.text,
    confidence: w.confidence,
    start: w.start,
    end: w.end,
  }));

  const confidence =
    rawWords.length > 0
      ? parseFloat(
          (rawWords.reduce((sum, w) => sum + w.confidence, 0) / rawWords.length).toFixed(6)
        )
      : null;

  return {
    transcript,
    duration_seconds: audio_duration,
    cost_usd,
    latency_ms,
    confidence,
    detected_language,
    words: rawWords,
    language_code,
  };
}
