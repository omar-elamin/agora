# DynaSent Eval Backend

FastAPI microservice that evaluates LLM sentiment classification against DynaSent R1 (in-distribution) and R2 (adversarial/OOD) benchmarks.

## Quick start

```bash
pip install -r requirements.txt
OPENAI_API_KEY=sk-… python main.py
```

## Docker

```bash
docker build -t eval-backend .
docker run -p 8787:8787 -e OPENAI_API_KEY=sk-… eval-backend
```

## Endpoints

### `GET /health`

Returns `{"status": "ok"}`.

### `POST /eval/sentiment`

```json
{
  "model_vendor": "openai",
  "model_endpoint": "gpt-4o",
  "config": { "label_filter": ["positive", "negative"] }
}
```

Response:

```json
{
  "task": "sentiment_ood",
  "source": "live_inference_v1",
  "result": {
    "id_accuracy": 0.875,
    "ood_accuracy": 0.74,
    "degradation_delta": 0.135,
    "degradation_tier": "moderate",
    "id_n": 200,
    "ood_n": 200
  }
}
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Required for OpenAI models |
| `ANTHROPIC_API_KEY` | — | Required for Anthropic models |
| `GOOGLE_API_KEY` | — | Required for Google models |
| `DYNASENT_SAMPLE_SIZE` | `200` | Examples per split (max ~1200) |
| `MODEL_TIMEOUT_SECS` | `30` | Per-call timeout in seconds |
| `PORT` | `8787` | Server port |

## Supported vendors

- `openai` — Chat completions API
- `anthropic` — Messages API
- `google` — Generative AI API

## Degradation tiers

| Tier | Delta (ID − OOD accuracy) |
|---|---|
| robust | < 5% |
| moderate | 5–15% |
| significant | > 15% |
