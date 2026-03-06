import { TranscriptionVendor } from "../types.js";
import { deepgram } from "./deepgram.js";
import { assemblyai } from "./assemblyai.js";
import { whisper } from "./whisper.js";

export const vendorRegistry: Record<string, TranscriptionVendor> = {
  deepgram,
  assemblyai,
  whisper,
};
