# Agora Webhook Demo Server

Receives drift-alert webhooks from Agora's evaluation pipeline, stores them in SQLite, and serves a live dashboard.

## Quick Start

```bash
cd services/webhook-demo
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

Open http://localhost:8080 and click **Seed Demo Data**.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Dashboard UI |
| `POST` | `/agora/alerts` | Receive a webhook alert |
| `POST` | `/seed` | Insert 8 demo alerts |
| `GET` | `/health` | Health check |

## Webhook Payload

```json
{
  "event": "agora.drift_alert",
  "version": "1.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "quarter": "2021-Q3",
    "category": "SHARES",
    "severity": "CRITICAL",
    "rel_drop_pct": 64.1,
    "recommendation": "Urgent retrain required..."
  }
}
```

## Deploy to Fly.io

```bash
fly apps create agora-webhook-demo
fly volumes create data --size 1 --region sjc
fly deploy
```
