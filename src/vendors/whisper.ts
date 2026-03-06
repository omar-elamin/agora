import OpenAI from "openai";
import { TranscriptionVendor, VendorInfo } from "../types.js";

const info: VendorInfo = {
  name: "whisper",
  capabilities: ["transcription", "translation", "language-detection"],
  pricing: { per_minute_usd: 0.006, model: "whisper-1" },
};

export const whisper: TranscriptionVendor = {
  name: info.name,
  info,

  async transcribe(audioUrl: string) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // Fetch the audio file to pass to OpenAI
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const file = new File([arrayBuffer], "audio.wav", { type: "audio/wav" });

    const result = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
    });

    const transcript = result.text ?? "";
    const duration_seconds = (result as unknown as { duration?: number }).duration ?? 0;

    return { transcript, duration_seconds };
  },
};
