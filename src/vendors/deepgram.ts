import { createClient } from "@deepgram/sdk";
import { TranscriptionVendor, VendorInfo } from "../types.js";

const info: VendorInfo = {
  name: "deepgram",
  capabilities: ["transcription", "diarization", "punctuation", "language-detection"],
  pricing: { per_minute_usd: 0.0043, model: "nova-2" },
};

export const deepgram: TranscriptionVendor = {
  name: info.name,
  info,

  async transcribe(audioUrl: string) {
    const client = createClient(process.env.DEEPGRAM_API_KEY!);

    const { result } = await client.listen.prerecorded.transcribeUrl(
      { url: audioUrl },
      { model: "nova-2", smart_format: true },
    );

    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    const duration_seconds = result?.metadata?.duration ?? 0;

    return { transcript, duration_seconds };
  },
};
