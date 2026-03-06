# Agora

Agora is an AI vendor eval platform that lets you benchmark transcription vendors side-by-side. Point it at an audio file, pick your vendors (Deepgram, AssemblyAI, Whisper), and get back raw transcripts, latency, cost, and throughput — all in one response.

## Quickstart

```bash
npm install
cp .env.example .env   # fill in your API keys
npm run dev
```

## API

### POST /eval/transcription

Run a transcription eval across one or more vendors.

```bash
curl -X POST http://localhost:3000/eval/transcription \
  -H "Content-Type: application/json" \
  -d '{
    "audio_url": "https://example.com/audio.wav",
    "vendors": ["deepgram", "assemblyai", "whisper"]
  }'
```

**Response:**

```json
{
  "id": "a1b2c3d4-...",
  "audio_url": "https://example.com/audio.wav",
  "results": [
    {
      "vendor": "deepgram",
      "transcript": "Hello world...",
      "latency_ms": 1200,
      "cost_usd": 0.000215,
      "words_per_second": 2.85
    }
  ]
}
```

### GET /evals/:id

Retrieve a past eval by ID.

```bash
curl http://localhost:3000/evals/a1b2c3d4-...
```

### GET /evals/:id/summary

Get a comparison summary with scores and a winner verdict.

```bash
curl http://localhost:3000/evals/a1b2c3d4-.../summary
```

**Response:**

```json
{
  "id": "a1b2c3d4-...",
  "audio_url": "https://example.com/audio.wav",
  "created_at": "2026-03-05T12:00:00Z",
  "winner": "deepgram",
  "verdict": "deepgram is 40% faster than assemblyai and 20% cheaper.",
  "results": [
    {
      "vendor": "deepgram",
      "latency_ms": 1200,
      "cost_usd": 0.000215,
      "words_per_second": 2.85,
      "speed_score": 1.0,
      "cost_score": 1.0,
      "overall_score": 1.0
    }
  ]
}
```

### GET /vendors

List supported vendors with capabilities and pricing.

```bash
curl http://localhost:3000/vendors
```

**Response:**

```json
{
  "vendors": [
    {
      "name": "deepgram",
      "capabilities": ["transcription", "diarization", "punctuation", "language-detection"],
      "pricing": { "per_minute_usd": 0.0043, "model": "nova-2" }
    }
  ]
}
```

### POST /waitlist

Join the waitlist.

```bash
curl -X POST http://localhost:3000/waitlist \
  -H "Content-Type: application/json" \
  -d '{"handle": "@yourhandle", "use_case": "benchmarking TTS vendors"}'
```

### GET /health

Health check.

```bash
curl http://localhost:3000/health
```

## Adding a new vendor

1. Create `src/vendors/yourvendor.ts`:

```typescript
import { TranscriptionVendor, VendorInfo } from "../types.js";

const info: VendorInfo = {
  name: "yourvendor",
  capabilities: ["transcription"],
  pricing: { per_minute_usd: 0.005, model: "default" },
};

export const yourvendor: TranscriptionVendor = {
  name: info.name,
  info,
  async transcribe(audioUrl: string) {
    // Call vendor API, return { transcript, duration_seconds }
    return { transcript: "...", duration_seconds: 60 };
  },
};
```

2. Register it in `src/vendors/registry.ts`:

```typescript
import { yourvendor } from "./yourvendor.js";

export const vendorRegistry: Record<string, TranscriptionVendor> = {
  // ...existing vendors
  yourvendor,
};
```

3. Add any new env vars to `.env.example` and `.env`.

That's it — the new vendor is immediately available in `/eval/transcription` and `/vendors`.
