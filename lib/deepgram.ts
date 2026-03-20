const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;
const COST_PER_MINUTE_USD = 0.0043; // Nova-3

export interface DeepgramResult {
  transcript: string;
  duration_seconds: number;
  cost_usd: number;
  latency_ms: number;
  confidence: number | null;
}

export async function transcribe(audioUrl: string): Promise<DeepgramResult> {
  const start = performance.now();

  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioUrl }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deepgram API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const latency_ms = Math.round(performance.now() - start);

  const alt = data?.results?.channels?.[0]?.alternatives?.[0];
  const transcript = alt?.transcript ?? "";
  const duration_seconds = data?.metadata?.duration ?? 0;
  const cost_usd = parseFloat(
    ((duration_seconds / 60) * COST_PER_MINUTE_USD).toFixed(6)
  );

  // Extract average word-level confidence from Nova-3 response
  const words: { confidence: number }[] = alt?.words ?? [];
  const confidence =
    words.length > 0
      ? parseFloat(
          (words.reduce((sum, w) => sum + w.confidence, 0) / words.length).toFixed(6)
        )
      : null;

  return { transcript, duration_seconds, cost_usd, latency_ms, confidence };
}
