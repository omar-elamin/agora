from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import random
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import anthropic
import google.generativeai as genai
import openai
from datasets import load_dataset
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("eval-backend")

SAMPLE_SIZE = int(os.environ.get("DYNASENT_SAMPLE_SIZE", "200"))
MODEL_TIMEOUT = int(os.environ.get("MODEL_TIMEOUT_SECS", "30"))
VALID_LABELS = {"positive", "negative", "neutral"}

EVAL_CACHE_PATH = os.environ.get("EVAL_CACHE_PATH", "/tmp/agora_eval_cache.db")
EVAL_CACHE_TTL_DAYS = int(os.environ.get("EVAL_CACHE_TTL_DAYS", "7"))

PROMPT_TEMPLATE = (
    "Classify the sentiment of the following text as exactly one of: "
    "positive, negative, or neutral.\n\n"
    "Text: {text}\n\n"
    "Respond with a single word: positive, negative, or neutral."
)

# ---------------------------------------------------------------------------
# Dataset loading (cached after first call)
# ---------------------------------------------------------------------------
_dataset_cache: dict[str, list[dict]] = {}


def _label_int_to_str(label: int) -> str:
    return {0: "negative", 1: "neutral", 2: "positive"}[label]


def load_dynasent_split(round_name: str) -> list[dict]:
    """Load a DynaSent test split. round_name is 'r1' or 'r2'."""
    if round_name in _dataset_cache:
        return _dataset_cache[round_name]

    subset = "dynabench.dynasent.r1.all" if round_name == "r1" else "dynabench.dynasent.r2.all"
    log.info("Loading DynaSent %s from HuggingFace…", round_name)
    ds = load_dataset("dynabench/dynasent", subset, split="test", trust_remote_code=True)
    rows = [
        {"text": row["sentence"], "gold": _label_int_to_str(row["gold_label"])}
        for row in ds
        if row["gold_label"] in (0, 1, 2)
    ]
    _dataset_cache[round_name] = rows
    log.info("Loaded %d examples for %s", len(rows), round_name)
    return rows


# ---------------------------------------------------------------------------
# Vendor dispatch
# ---------------------------------------------------------------------------
async def _call_openai(endpoint: str, text: str) -> str:
    client = openai.AsyncOpenAI(timeout=MODEL_TIMEOUT)
    resp = await client.chat.completions.create(
        model=endpoint,
        messages=[{"role": "user", "content": PROMPT_TEMPLATE.format(text=text)}],
        max_tokens=8,
        temperature=0,
    )
    return resp.choices[0].message.content.strip().lower()


async def _call_anthropic(endpoint: str, text: str) -> str:
    client = anthropic.AsyncAnthropic(timeout=MODEL_TIMEOUT)
    resp = await client.messages.create(
        model=endpoint,
        max_tokens=8,
        messages=[{"role": "user", "content": PROMPT_TEMPLATE.format(text=text)}],
    )
    return resp.content[0].text.strip().lower()


async def _call_google(endpoint: str, text: str) -> str:
    genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
    model = genai.GenerativeModel(endpoint)
    # google-generativeai is sync; run in executor
    loop = asyncio.get_running_loop()
    resp = await loop.run_in_executor(
        None,
        lambda: model.generate_content(
            PROMPT_TEMPLATE.format(text=text),
            generation_config=genai.types.GenerationConfig(max_output_tokens=8, temperature=0),
        ),
    )
    return resp.text.strip().lower()


VENDOR_REGISTRY: dict[str, Any] = {
    "openai": _call_openai,
    "anthropic": _call_anthropic,
    "google": _call_google,
}


def _parse_label(raw: str) -> str | None:
    raw = raw.strip().lower().rstrip(".")
    for label in VALID_LABELS:
        if label in raw:
            return label
    return None


# ---------------------------------------------------------------------------
# Evaluation logic
# ---------------------------------------------------------------------------
async def _evaluate_split(
    vendor_fn,
    endpoint: str,
    examples: list[dict],
    label_filter: set[str] | None,
    on_progress=None,
) -> tuple[int, int]:
    """Evaluate a dataset split. If *on_progress* is provided it is called
    after every classification with ``(completed, total, correct)``."""
    if label_filter:
        examples = [e for e in examples if e["gold"] in label_filter]

    if len(examples) > SAMPLE_SIZE:
        examples = random.sample(examples, SAMPLE_SIZE)

    sem = asyncio.Semaphore(10)
    correct = 0
    total = 0
    completed = 0
    n = len(examples)

    async def _classify(ex: dict) -> None:
        nonlocal correct, total, completed
        async with sem:
            try:
                raw = await asyncio.wait_for(vendor_fn(endpoint, ex["text"]), timeout=MODEL_TIMEOUT)
                pred = _parse_label(raw)
                if pred is not None:
                    total += 1
                    if pred == ex["gold"]:
                        correct += 1
                else:
                    log.warning("Unparseable response: %r", raw)
                    total += 1  # count as wrong
            except Exception:
                log.exception("Error classifying example")
                total += 1  # count as wrong
            completed += 1
            if on_progress is not None:
                on_progress(completed, n, correct)

    await asyncio.gather(*[_classify(ex) for ex in examples])
    return correct, total


# ---------------------------------------------------------------------------
# SQLite result cache
# ---------------------------------------------------------------------------
def _init_cache_db() -> None:
    """Create the cache table if it doesn't exist."""
    with _cache_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS eval_cache (
                cache_key   TEXT PRIMARY KEY,
                model_vendor    TEXT NOT NULL,
                model_endpoint  TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                result_json TEXT NOT NULL
            )
            """
        )


@contextmanager
def _cache_conn():
    """Yield a sqlite3 connection with WAL mode for concurrent reads."""
    conn = sqlite3.connect(EVAL_CACHE_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _make_cache_key(model_vendor: str, model_endpoint: str, config: dict | None, sample_size: int) -> str:
    """SHA-256 of the deterministic request parameters."""
    payload = json.dumps(
        {
            "model_vendor": model_vendor,
            "model_endpoint": model_endpoint,
            "config": config,
            "sample_size": sample_size,
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _cache_get(key: str) -> dict | None:
    """Return cached result dict if present and not expired, else None."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=EVAL_CACHE_TTL_DAYS)).isoformat()
    with _cache_conn() as conn:
        row = conn.execute(
            "SELECT result_json FROM eval_cache WHERE cache_key = ? AND created_at > ?",
            (key, cutoff),
        ).fetchone()
    if row:
        return json.loads(row[0])
    return None


def _cache_put(key: str, model_vendor: str, model_endpoint: str, result: dict) -> None:
    """Insert or replace a cache entry."""
    with _cache_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO eval_cache (cache_key, model_vendor, model_endpoint, created_at, result_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (key, model_vendor, model_endpoint, datetime.now(timezone.utc).isoformat(), json.dumps(result)),
        )


def _cache_clear() -> int:
    """Delete all rows from the cache table. Returns rows deleted."""
    with _cache_conn() as conn:
        cur = conn.execute("DELETE FROM eval_cache")
        return cur.rowcount


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="DynaSent Eval Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    _init_cache_db()
    log.info("Cache DB initialised at %s (TTL=%d days)", EVAL_CACHE_PATH, EVAL_CACHE_TTL_DAYS)


class EvalRequest(BaseModel):
    model_vendor: str
    model_endpoint: str
    config: Optional[dict] = None


class EvalResult(BaseModel):
    id_accuracy: float
    ood_accuracy: float
    degradation_delta: float
    degradation_tier: str
    id_n: int
    ood_n: int


class EvalResponse(BaseModel):
    task: str = "sentiment_ood"
    source: str = "live_inference_v1"
    result: EvalResult


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/eval/sentiment", response_model=EvalResponse)
async def eval_sentiment(req: EvalRequest):
    vendor = req.model_vendor.lower()
    if vendor not in VENDOR_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown vendor: {vendor}. Supported: {list(VENDOR_REGISTRY)}")

    # --- cache lookup ---
    cache_key = _make_cache_key(vendor, req.model_endpoint, req.config, SAMPLE_SIZE)
    cached = _cache_get(cache_key)
    if cached is not None:
        log.info("Cache HIT for key=%s vendor=%s endpoint=%s", cache_key[:12], vendor, req.model_endpoint)
        return EvalResponse(source="cached_v1", result=EvalResult(**cached))

    log.info("Cache MISS for key=%s — running live inference", cache_key[:12])

    vendor_fn = VENDOR_REGISTRY[vendor]
    label_filter: set[str] | None = None
    if req.config and "label_filter" in req.config:
        label_filter = set(req.config["label_filter"])

    log.info("Starting eval: vendor=%s endpoint=%s sample_size=%d", vendor, req.model_endpoint, SAMPLE_SIZE)

    r1 = load_dynasent_split("r1")
    r2 = load_dynasent_split("r2")

    id_correct, id_total = await _evaluate_split(vendor_fn, req.model_endpoint, r1, label_filter)
    ood_correct, ood_total = await _evaluate_split(vendor_fn, req.model_endpoint, r2, label_filter)

    id_acc = id_correct / id_total if id_total else 0.0
    ood_acc = ood_correct / ood_total if ood_total else 0.0
    delta = id_acc - ood_acc

    if delta < 0.05:
        tier = "robust"
    elif delta < 0.15:
        tier = "moderate"
    else:
        tier = "significant"

    log.info("Eval complete: id_acc=%.3f ood_acc=%.3f delta=%.3f tier=%s", id_acc, ood_acc, delta, tier)

    result = EvalResult(
        id_accuracy=round(id_acc, 4),
        ood_accuracy=round(ood_acc, 4),
        degradation_delta=round(delta, 4),
        degradation_tier=tier,
        id_n=id_total,
        ood_n=ood_total,
    )

    # --- cache store ---
    _cache_put(cache_key, vendor, req.model_endpoint, result.model_dump())

    return EvalResponse(result=result)


def _sse_event(payload: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(payload)}\n\n"


@app.get("/eval/sentiment/stream")
async def eval_sentiment_stream(
    model_vendor: str = Query(...),
    model_endpoint: str = Query(...),
    config: Optional[str] = Query(None),
):
    """SSE streaming endpoint that reports classification progress."""
    vendor = model_vendor.lower()
    if vendor not in VENDOR_REGISTRY:
        async def _error_gen():
            yield _sse_event({"type": "error", "message": f"Unknown vendor: {vendor}. Supported: {list(VENDOR_REGISTRY)}"})
        return StreamingResponse(_error_gen(), media_type="text/event-stream")

    parsed_config: dict | None = None
    if config is not None:
        try:
            parsed_config = json.loads(config)
        except json.JSONDecodeError as exc:
            async def _error_gen():
                yield _sse_event({"type": "error", "message": f"Invalid config JSON: {exc}"})
            return StreamingResponse(_error_gen(), media_type="text/event-stream")

    cache_key = _make_cache_key(vendor, model_endpoint, parsed_config, SAMPLE_SIZE)
    cached = _cache_get(cache_key)

    if cached is not None:
        log.info("Stream cache HIT for key=%s", cache_key[:12])

        async def _cached_gen():
            yield _sse_event({
                "type": "result",
                "task": "sentiment_ood",
                "source": "cached_v1",
                "result": cached,
            })

        return StreamingResponse(_cached_gen(), media_type="text/event-stream")

    log.info("Stream cache MISS for key=%s — running live inference", cache_key[:12])

    async def _stream_gen():
        try:
            vendor_fn = VENDOR_REGISTRY[vendor]
            label_filter: set[str] | None = None
            if parsed_config and "label_filter" in parsed_config:
                label_filter = set(parsed_config["label_filter"])

            r1 = load_dynasent_split("r1")
            r2 = load_dynasent_split("r2")

            # -- ID split with progress --
            progress_queue: asyncio.Queue[dict] = asyncio.Queue()

            def _id_progress(completed: int, total: int, correct: int) -> None:
                progress_queue.put_nowait({
                    "type": "progress",
                    "phase": "id",
                    "completed": completed,
                    "total": total,
                    "correct": correct,
                })

            id_task = asyncio.create_task(
                _evaluate_split(vendor_fn, model_endpoint, r1, label_filter, on_progress=_id_progress)
            )

            while not id_task.done():
                try:
                    event = await asyncio.wait_for(progress_queue.get(), timeout=0.5)
                    yield _sse_event(event)
                except asyncio.TimeoutError:
                    continue

            # Drain any remaining progress events
            while not progress_queue.empty():
                yield _sse_event(progress_queue.get_nowait())

            id_correct, id_total = id_task.result()

            # -- OOD split with progress --
            def _ood_progress(completed: int, total: int, correct: int) -> None:
                progress_queue.put_nowait({
                    "type": "progress",
                    "phase": "ood",
                    "completed": completed,
                    "total": total,
                    "correct": correct,
                })

            ood_task = asyncio.create_task(
                _evaluate_split(vendor_fn, model_endpoint, r2, label_filter, on_progress=_ood_progress)
            )

            while not ood_task.done():
                try:
                    event = await asyncio.wait_for(progress_queue.get(), timeout=0.5)
                    yield _sse_event(event)
                except asyncio.TimeoutError:
                    continue

            while not progress_queue.empty():
                yield _sse_event(progress_queue.get_nowait())

            ood_correct, ood_total = ood_task.result()

            # -- Compute final result --
            id_acc = id_correct / id_total if id_total else 0.0
            ood_acc = ood_correct / ood_total if ood_total else 0.0
            delta = id_acc - ood_acc

            if delta < 0.05:
                tier = "robust"
            elif delta < 0.15:
                tier = "moderate"
            else:
                tier = "significant"

            result_dict = {
                "id_accuracy": round(id_acc, 4),
                "ood_accuracy": round(ood_acc, 4),
                "degradation_delta": round(delta, 4),
                "degradation_tier": tier,
                "id_n": id_total,
                "ood_n": ood_total,
            }

            _cache_put(cache_key, vendor, model_endpoint, result_dict)

            yield _sse_event({
                "type": "result",
                "task": "sentiment_ood",
                "source": "live_inference_v1",
                "result": result_dict,
            })

        except Exception as exc:
            log.exception("Streaming eval failed")
            yield _sse_event({"type": "error", "message": str(exc)})

    return StreamingResponse(
        _stream_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/eval/cache/clear")
async def clear_cache():
    """Delete all cached eval results."""
    deleted = _cache_clear()
    log.info("Cache cleared: %d rows deleted", deleted)
    return {"deleted": deleted}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8787"))
    uvicorn.run(app, host="0.0.0.0", port=port)
