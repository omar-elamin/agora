export interface TranscriptionResult {
  vendor: string;
  transcript: string;
  latency_ms: number;
  cost_usd: number;
  words_per_second: number;
}

export interface EvalRequest {
  audio_url: string;
  vendors: string[];
}

export interface EvalRecord {
  id: string;
  audio_url: string;
  results: TranscriptionResult[];
  created_at: string;
}

export interface VendorInfo {
  name: string;
  capabilities: string[];
  pricing: {
    per_minute_usd: number;
    model: string;
  };
}

export interface WaitlistEntry {
  handle: string;
  use_case: string;
}

export interface TranscriptionVendor {
  name: string;
  transcribe(audioUrl: string): Promise<{ transcript: string; duration_seconds: number }>;
  info: VendorInfo;
}
