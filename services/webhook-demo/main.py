"""Agora Webhook Receiver — Demo Server.

Receives drift-alert webhooks, stores them in SQLite,
and serves a live dashboard for demo day.
"""

import json
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, field_validator

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DB_PATH = Path(__file__).parent / "alerts.db"


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    conn = _get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS alerts (
            id              TEXT PRIMARY KEY,
            received_at     TEXT NOT NULL,
            quarter         TEXT NOT NULL,
            category        TEXT NOT NULL,
            severity        TEXT NOT NULL,
            baseline_f1     REAL,
            current_f1      REAL,
            abs_drop        REAL,
            rel_drop_pct    REAL NOT NULL,
            trigger_type    TEXT,
            recommendation  TEXT NOT NULL,
            filing_count    INTEGER,
            raw_payload     TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class AlertData(BaseModel):
    quarter: str
    category: str
    severity: str
    rel_drop_pct: float
    recommendation: str
    baseline_f1: Optional[float] = None
    current_f1: Optional[float] = None
    abs_drop: Optional[float] = None
    trigger: Optional[str] = None
    filing_count: Optional[int] = None
    timestamp: Optional[str] = None


class WebhookEnvelope(BaseModel):
    event: str
    version: str
    timestamp: Optional[str] = None
    data: AlertData

    @field_validator("event")
    @classmethod
    def event_must_be_drift_alert(cls, v: str) -> str:
        if v != "agora.drift_alert":
            raise ValueError("event must be 'agora.drift_alert'")
        return v


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_db()
    yield


app = FastAPI(title="Agora Webhook Demo", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agora-webhook-demo"}


@app.post("/agora/alerts")
async def receive_alert(envelope: WebhookEnvelope, request: Request):
    raw = await request.body()
    now = datetime.now(timezone.utc).isoformat()
    alert_id = str(uuid.uuid4())
    d = envelope.data

    conn = _get_db()
    conn.execute(
        """
        INSERT INTO alerts
            (id, received_at, quarter, category, severity,
             baseline_f1, current_f1, abs_drop, rel_drop_pct,
             trigger_type, recommendation, filing_count, raw_payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            alert_id,
            now,
            d.quarter,
            d.category,
            d.severity,
            d.baseline_f1,
            d.current_f1,
            d.abs_drop,
            d.rel_drop_pct,
            d.trigger,
            d.recommendation,
            d.filing_count,
            raw.decode(),
        ),
    )
    conn.commit()
    conn.close()

    return JSONResponse(
        {"accepted": True, "id": alert_id, "received_at": now}, status_code=201
    )


# ---------------------------------------------------------------------------
# Seed demo data
# ---------------------------------------------------------------------------

DEMO_ALERTS = [
    {
        "quarter": "2019-Q4",
        "category": "PRICE",
        "severity": "CRITICAL",
        "baseline_f1": 0.509,
        "current_f1": 0.183,
        "abs_drop": 0.326,
        "rel_drop_pct": 64.1,
        "trigger": "both",
        "recommendation": "Urgent retrain required — PRICE extraction accuracy dropped 64 % since baseline.",
        "filing_count": 22,
    },
    {
        "quarter": "2020-Q4",
        "category": "PRICE",
        "severity": "CRITICAL",
        "baseline_f1": 0.509,
        "current_f1": 0.212,
        "abs_drop": 0.297,
        "rel_drop_pct": 58.3,
        "trigger": "both",
        "recommendation": "Urgent retrain required — PRICE extraction accuracy dropped 58 % since baseline.",
        "filing_count": 18,
    },
    {
        "quarter": "2021-Q3",
        "category": "PRICE",
        "severity": "CRITICAL",
        "baseline_f1": 0.509,
        "current_f1": 0.183,
        "abs_drop": 0.326,
        "rel_drop_pct": 64.1,
        "trigger": "both",
        "recommendation": "Urgent retrain required — PRICE extraction accuracy dropped 64 % since baseline.",
        "filing_count": 15,
    },
    {
        "quarter": "2021-Q3",
        "category": "SHARES",
        "severity": "CRITICAL",
        "baseline_f1": 0.509,
        "current_f1": 0.183,
        "abs_drop": 0.326,
        "rel_drop_pct": 64.1,
        "trigger": "both",
        "recommendation": "Urgent retrain required — SHARES extraction accuracy dropped 64 % since baseline.",
        "filing_count": 15,
    },
    {
        "quarter": "2021-Q3",
        "category": "DURATION",
        "severity": "ALERT",
        "baseline_f1": 0.614,
        "current_f1": 0.379,
        "abs_drop": 0.235,
        "rel_drop_pct": 38.2,
        "trigger": "relative",
        "recommendation": "Consider retraining — DURATION extraction accuracy dropped 38 % since baseline.",
        "filing_count": 15,
    },
    {
        "quarter": "2022-Q2",
        "category": "PRICE",
        "severity": "CRITICAL",
        "baseline_f1": 0.509,
        "current_f1": 0.148,
        "abs_drop": 0.361,
        "rel_drop_pct": 71.0,
        "trigger": "both",
        "recommendation": "Urgent retrain required — PRICE extraction accuracy dropped 71 % since baseline.",
        "filing_count": 12,
    },
    {
        "quarter": "2022-Q2",
        "category": "SHARES",
        "severity": "CRITICAL",
        "baseline_f1": 0.509,
        "current_f1": 0.160,
        "abs_drop": 0.349,
        "rel_drop_pct": 68.5,
        "trigger": "both",
        "recommendation": "Urgent retrain required — SHARES extraction accuracy dropped 69 % since baseline.",
        "filing_count": 12,
    },
    {
        "quarter": "2022-Q2",
        "category": "DURATION",
        "severity": "ALERT",
        "baseline_f1": 0.614,
        "current_f1": 0.356,
        "abs_drop": 0.258,
        "rel_drop_pct": 42.1,
        "trigger": "relative",
        "recommendation": "Consider retraining — DURATION extraction accuracy dropped 42 % since baseline.",
        "filing_count": 12,
    },
]


@app.post("/seed")
async def seed_demo_data():
    conn = _get_db()
    now = datetime.now(timezone.utc)
    inserted = 0
    for i, d in enumerate(DEMO_ALERTS):
        alert_id = str(uuid.uuid4())
        envelope = {
            "event": "agora.drift_alert",
            "version": "1.0",
            "timestamp": now.isoformat(),
            "data": d,
        }
        conn.execute(
            """
            INSERT INTO alerts
                (id, received_at, quarter, category, severity,
                 baseline_f1, current_f1, abs_drop, rel_drop_pct,
                 trigger_type, recommendation, filing_count, raw_payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alert_id,
                now.isoformat(),
                d["quarter"],
                d["category"],
                d["severity"],
                d.get("baseline_f1"),
                d.get("current_f1"),
                d.get("abs_drop"),
                d["rel_drop_pct"],
                d.get("trigger"),
                d["recommendation"],
                d.get("filing_count"),
                json.dumps(envelope),
            ),
        )
        inserted += 1
    conn.commit()
    conn.close()
    return {"seeded": inserted}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


@app.get("/", response_class=HTMLResponse)
async def dashboard():
    conn = _get_db()
    rows = conn.execute(
        "SELECT * FROM alerts ORDER BY received_at DESC"
    ).fetchall()

    total = len(rows)
    critical = sum(1 for r in rows if r["severity"] == "CRITICAL")
    categories = len(set(r["category"] for r in rows)) if rows else 0

    severity_color = {
        "CRITICAL": "#ef4444",
        "ALERT": "#f59e0b",
        "INFO": "#3b82f6",
    }

    table_rows = ""
    for r in rows:
        color = severity_color.get(r["severity"], "#94a3b8")
        table_rows += f"""
        <tr>
            <td>{r['received_at'][:19].replace('T', ' ')}</td>
            <td>{r['quarter']}</td>
            <td>{r['category']}</td>
            <td><span class="badge" style="background:{color}">{r['severity']}</span></td>
            <td class="num">{r['rel_drop_pct']:.1f}%</td>
            <td class="rec">{r['recommendation']}</td>
        </tr>"""

    conn.close()

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>Agora — Drift Alert Dashboard</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    min-height: 100vh;
  }}
  .container {{ max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }}

  header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }}
  h1 {{
    font-size: 1.75rem;
    font-weight: 700;
    background: linear-gradient(135deg, #818cf8, #c084fc);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
  }}
  h1 span {{ font-weight: 400; opacity: 0.7; }}

  .actions {{ display: flex; gap: 0.75rem; }}
  .btn {{
    padding: 0.5rem 1.25rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }}
  .btn-primary {{
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
  }}
  .btn-primary:hover {{ opacity: 0.9; transform: translateY(-1px); }}
  .btn-ghost {{
    background: rgba(255,255,255,0.06);
    color: #94a3b8;
    border: 1px solid rgba(255,255,255,0.08);
  }}
  .btn-ghost:hover {{ background: rgba(255,255,255,0.1); color: #e2e8f0; }}

  .stats {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }}
  .stat {{
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 0.75rem;
    padding: 1.25rem 1.5rem;
  }}
  .stat .label {{
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    margin-bottom: 0.25rem;
  }}
  .stat .value {{
    font-size: 2rem;
    font-weight: 700;
    color: #f8fafc;
  }}
  .stat .value.critical {{ color: #ef4444; }}
  .stat .value.purple {{ color: #a78bfa; }}

  .card {{
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 0.75rem;
    overflow: hidden;
  }}
  .card-header {{
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
  }}

  table {{ width: 100%; border-collapse: collapse; }}
  th {{
    text-align: left;
    padding: 0.75rem 1rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #475569;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }}
  td {{
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    vertical-align: top;
  }}
  tr:hover td {{ background: rgba(255,255,255,0.02); }}
  .num {{ font-variant-numeric: tabular-nums; font-weight: 600; }}
  .rec {{ color: #94a3b8; max-width: 320px; font-size: 0.8rem; line-height: 1.4; }}

  .badge {{
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
  }}

  .empty {{
    text-align: center;
    padding: 4rem 1rem;
    color: #475569;
  }}
  .empty p {{ margin-bottom: 1rem; }}

  .footer {{
    text-align: center;
    padding: 2rem 0 1rem;
    font-size: 0.75rem;
    color: #334155;
  }}

  .toast {{
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: #1e293b;
    border: 1px solid rgba(255,255,255,0.1);
    color: #e2e8f0;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }}
  .toast.show {{ opacity: 1; }}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Agora <span>Drift Alert Dashboard</span></h1>
    <div class="actions">
      <button class="btn btn-ghost" onclick="location.reload()">Refresh</button>
      <button class="btn btn-primary" id="seedBtn" onclick="seedData()">Seed Demo Data</button>
    </div>
  </header>

  <div class="stats">
    <div class="stat">
      <div class="label">Total Alerts</div>
      <div class="value">{total}</div>
    </div>
    <div class="stat">
      <div class="label">Critical</div>
      <div class="value critical">{critical}</div>
    </div>
    <div class="stat">
      <div class="label">Categories Affected</div>
      <div class="value purple">{categories}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Alert Timeline</div>
    {"<table><thead><tr><th>Received</th><th>Quarter</th><th>Category</th><th>Severity</th><th>Drop</th><th>Recommendation</th></tr></thead><tbody>" + table_rows + "</tbody></table>" if rows else '<div class="empty"><p>No alerts received yet.</p><p>Click <strong>Seed Demo Data</strong> to populate the dashboard, or POST a webhook to <code>/agora/alerts</code>.</p></div>'}
  </div>

  <div class="footer">Auto-refreshes every 30 s &middot; Agora Webhook Demo</div>
</div>

<div class="toast" id="toast"></div>

<script>
async function seedData() {{
  const btn = document.getElementById('seedBtn');
  btn.disabled = true;
  btn.textContent = 'Seeding\u2026';
  try {{
    const res = await fetch('/seed', {{ method: 'POST' }});
    const data = await res.json();
    showToast('Seeded ' + data.seeded + ' demo alerts');
    setTimeout(() => location.reload(), 800);
  }} catch (e) {{
    showToast('Error: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Seed Demo Data';
  }}
}}
function showToast(msg) {{
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}}
</script>
</body>
</html>"""
    return HTMLResponse(html)
