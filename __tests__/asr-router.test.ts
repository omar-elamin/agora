import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/assemblyai", () => ({
  detectLanguage: vi.fn(),
}));

vi.mock("@/lib/whisper", () => ({
  transcribe: vi.fn(),
}));

import { routeAndTranscribe } from "@/lib/asr-router";
import { detectLanguage } from "@/lib/assemblyai";
import { transcribe as whisperTranscribe } from "@/lib/whisper";

const mockDetectLanguage = vi.mocked(detectLanguage);
const mockWhisperTranscribe = vi.mocked(whisperTranscribe);

const FAKE_AUDIO_URL = "https://example.com/audio.mp3";

const fakeWhisperResult = {
  transcript: "hello world",
  duration_seconds: 30,
  cost_usd: 0.000925,
  latency_ms: 500,
  provider: "groq" as const,
  language: "en",
  language_probability: 0.99,
  segments: [],
  fallback_used: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockWhisperTranscribe.mockResolvedValue(fakeWhisperResult);
});

describe("asr-router", () => {
  it("rep always routes Route A with language=en", async () => {
    const result = await routeAndTranscribe(FAKE_AUDIO_URL, "rep");

    expect(result.routing.route).toBe("A");
    expect(result.routing.language_lock).toBe("en");
    expect(result.routing.ar_confidence).toBeNull();
    expect(mockDetectLanguage).not.toHaveBeenCalled();
    expect(mockWhisperTranscribe).toHaveBeenCalledWith(FAKE_AUDIO_URL, { language: "en" });
  });

  it("prospect with ar_confidence=0.90 routes Route B (no lock)", async () => {
    mockDetectLanguage.mockResolvedValue({
      detected_language: "ar",
      language_confidence: 0.9,
    });

    const result = await routeAndTranscribe(FAKE_AUDIO_URL, "prospect");

    expect(result.routing.route).toBe("B");
    expect(result.routing.language_lock).toBeNull();
    expect(result.routing.ar_confidence).toBe(0.9);
    expect(mockWhisperTranscribe).toHaveBeenCalledWith(FAKE_AUDIO_URL, undefined);
  });

  it("prospect with ar_confidence=0.50 routes Route A", async () => {
    mockDetectLanguage.mockResolvedValue({
      detected_language: "ar",
      language_confidence: 0.5,
    });

    const result = await routeAndTranscribe(FAKE_AUDIO_URL, "prospect");

    expect(result.routing.route).toBe("A");
    expect(result.routing.language_lock).toBe("en");
    expect(result.routing.ar_confidence).toBe(0.5);
    expect(mockWhisperTranscribe).toHaveBeenCalledWith(FAKE_AUDIO_URL, { language: "en" });
  });

  it("detection failure defaults to Route B", async () => {
    mockDetectLanguage.mockRejectedValue(new Error("API timeout"));

    const result = await routeAndTranscribe(FAKE_AUDIO_URL, "prospect");

    expect(result.routing.route).toBe("B");
    expect(result.routing.language_lock).toBeNull();
    expect(mockWhisperTranscribe).toHaveBeenCalledWith(FAKE_AUDIO_URL, undefined);
  });
});
