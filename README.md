# Agora

Benchmark any AI vendor on your data. Point it at an audio file, get back transcripts, latency, cost, and a recommendation — all in one response.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `DEEPGRAM_API_KEY` | Deepgram Nova-3 API key |
| `STRIPE_SECRET_KEY` | Stripe secret key for billing |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token |

## API

### Generate an API key

```bash
curl -X POST http://localhost:3000/api/v1/keys
```

```json
{ "api_key": "ag_abc123...", "created_at": "2026-03-06T..." }
```

### Run an eval

```bash
curl -X POST http://localhost:3000/api/v1/eval \
  -H "Content-Type: application/json" \
  -H "x-api-key: ag_abc123..." \
  -d '{"audio_url": "https://example.com/audio.wav"}'
```

With ground truth (computes WER):

```bash
curl -X POST http://localhost:3000/api/v1/eval \
  -H "Content-Type: application/json" \
  -H "x-api-key: ag_abc123..." \
  -d '{
    "audio_url": "https://example.com/audio.wav",
    "ground_truth": "the exact transcript text"
  }'
```

**Response:**

```json
{
  "eval_id": "a1b2c3d4-...",
  "status": "complete",
  "results": [
    {
      "vendor": "deepgram",
      "transcript": "Hello world...",
      "latency_ms": 1200,
      "cost_usd": 0.000215,
      "wer": 0.05,
      "rank": 1
    }
  ],
  "recommendation": {
    "best_accuracy": "deepgram",
    "best_speed": "deepgram",
    "best_cost": "deepgram"
  }
}
```

### Get eval results

```bash
curl http://localhost:3000/api/v1/eval/EVAL_ID
```

### Health check

```bash
curl http://localhost:3000/api/health
```
