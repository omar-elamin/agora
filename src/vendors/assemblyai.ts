import { AssemblyAI } from "assemblyai";
import { TranscriptionVendor, VendorInfo } from "../types.js";

const info: VendorInfo = {
  name: "assemblyai",
  capabilities: ["transcription", "diarization", "punctuation", "sentiment-analysis", "summarization"],
  pricing: { per_minute_usd: 0.0062, model: "best" },
};

export const assemblyai: TranscriptionVendor = {
  name: info.name,
  info,

  async transcribe(audioUrl: string) {
    const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });

    const transcript = await client.transcripts.transcribe({
      audio_url: audioUrl,
    });

    const text = transcript.text ?? "";
    const duration_seconds = (transcript.audio_duration ?? 0);

    return { transcript: text, duration_seconds };
  },
};
