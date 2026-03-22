"""Tests for the DynaSent eval backend (caching, accuracy, tiers, errors)."""
from __future__ import annotations

import os
import sys
import tempfile
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Point cache at a temp file before importing the app
_tmp_cache = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["EVAL_CACHE_PATH"] = _tmp_cache.name

# Stub out heavy vendor SDKs and datasets so main.py can be imported without them.
for _mod_name in (
    "anthropic",
    "google",
    "google.generativeai",
    "google.generativeai.types",
    "openai",
    "datasets",
):
    if _mod_name not in sys.modules:
        _stub = types.ModuleType(_mod_name)
        # datasets.load_dataset needs to be callable
        if _mod_name == "datasets":
            _stub.load_dataset = MagicMock()  # type: ignore[attr-defined]
        # google.generativeai stubs
        if _mod_name == "google.generativeai":
            _stub.configure = MagicMock()  # type: ignore[attr-defined]
            _stub.GenerativeModel = MagicMock()  # type: ignore[attr-defined]
            _stub.types = types.ModuleType("google.generativeai.types")  # type: ignore[attr-defined]
            _stub.types.GenerationConfig = MagicMock()  # type: ignore[attr-defined]
        sys.modules[_mod_name] = _stub

# Ensure google parent package contains the sub-module
sys.modules["google"].generativeai = sys.modules["google.generativeai"]  # type: ignore[attr-defined]

# The service lives in services/eval-backend/ (hyphenated) so we add it to sys.path.
_SERVICE_DIR = Path(__file__).resolve().parents[2] / "services" / "eval-backend"
sys.path.insert(0, str(_SERVICE_DIR))

import main as eval_main  # noqa: E402

app = eval_main.app
_parse_label = eval_main._parse_label
_MODULE = "main"


def _init_cache_db():
    eval_main.cache.init()


def _cache_clear():
    eval_main.cache.clear()

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
FAKE_R1 = [
    {"text": "I love this!", "gold": "positive"},
    {"text": "Terrible.", "gold": "negative"},
    {"text": "It was okay.", "gold": "neutral"},
    {"text": "Amazing work", "gold": "positive"},
]

FAKE_R2 = [
    {"text": "Pretty good", "gold": "positive"},
    {"text": "Awful experience", "gold": "negative"},
    {"text": "Meh", "gold": "neutral"},
    {"text": "Superb!", "gold": "positive"},
]


def _make_vendor_fn(id_labels: list[str], ood_labels: list[str]) -> AsyncMock:
    """Return an AsyncMock that yields *id_labels* for the first batch then *ood_labels*."""
    all_labels = id_labels + ood_labels
    mock = AsyncMock(side_effect=all_labels)
    return mock


@pytest_asyncio.fixture
async def client():
    _init_cache_db()
    _cache_clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# a) test_accuracy_computation
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_accuracy_computation(client: AsyncClient):
    """Mock vendor returns known labels; verify id/ood accuracy."""
    # R1 (ID): all correct  ->  4/4 = 1.0
    id_labels = ["positive", "negative", "neutral", "positive"]
    # R2 (OOD): 2 correct out of 4  ->  0.5
    ood_labels = ["positive", "positive", "neutral", "negative"]

    mock_fn = _make_vendor_fn(id_labels, ood_labels)

    with (
        patch(f"{_MODULE}.VENDOR_REGISTRY", {"testvendor": mock_fn}),
        patch(f"{_MODULE}.load_dynasent_split", side_effect=[FAKE_R1, FAKE_R2]),
        patch(f"{_MODULE}.SAMPLE_SIZE", 200),
    ):
        resp = await client.post(
            "/eval/sentiment",
            json={"model_vendor": "testvendor", "model_endpoint": "test-model"},
        )

    assert resp.status_code == 200
    data = resp.json()
    result = data["result"]
    assert result["id_accuracy"] == 1.0
    assert result["ood_accuracy"] == 0.5
    assert result["degradation_delta"] == 0.5
    assert result["id_n"] == 4
    assert result["ood_n"] == 4


# ---------------------------------------------------------------------------
# b) test_tier_assignment
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "id_correct,ood_correct,n,expected_tier",
    [
        # delta = 0.0 -> robust
        (4, 4, 4, "robust"),
        # delta = 0.04 -> robust (just under 0.05)
        (100, 96, 100, "robust"),
        # delta = 0.10 -> moderate
        (10, 9, 10, "moderate"),
        # delta = 0.20 -> significant
        (4, 0, 4, "significant"),
    ],
)
async def test_tier_assignment(
    client: AsyncClient,
    id_correct: int,
    ood_correct: int,
    n: int,
    expected_tier: str,
):
    """Parametrized tier boundaries."""
    id_labels = ["positive"] * id_correct + ["wrong"] * (n - id_correct)
    ood_labels = ["positive"] * ood_correct + ["wrong"] * (n - ood_correct)

    fake_data = [{"text": f"t{i}", "gold": "positive"} for i in range(n)]
    mock_fn = _make_vendor_fn(id_labels, ood_labels)

    with (
        patch(f"{_MODULE}.VENDOR_REGISTRY", {"testvendor": mock_fn}),
        patch(f"{_MODULE}.load_dynasent_split", side_effect=[fake_data, fake_data]),
        patch(f"{_MODULE}.SAMPLE_SIZE", 200),
    ):
        resp = await client.post(
            "/eval/sentiment",
            json={"model_vendor": "testvendor", "model_endpoint": "m"},
        )

    assert resp.status_code == 200
    assert resp.json()["result"]["degradation_tier"] == expected_tier


# ---------------------------------------------------------------------------
# c) test_error_handling_bad_vendor
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_error_handling_bad_vendor(client: AsyncClient):
    resp = await client.post(
        "/eval/sentiment",
        json={"model_vendor": "nonexistent_vendor", "model_endpoint": "x"},
    )
    assert resp.status_code == 400
    assert "nonexistent_vendor" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# d) test_cache_hit
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_cache_hit(client: AsyncClient):
    """Second identical request returns cached_v1 without calling vendor fn."""
    id_labels = ["positive", "negative", "neutral", "positive"]
    ood_labels = ["positive", "negative", "neutral", "positive"]

    mock_fn = _make_vendor_fn(id_labels, ood_labels)

    payload = {"model_vendor": "testvendor", "model_endpoint": "cached-model"}

    with (
        patch(f"{_MODULE}.VENDOR_REGISTRY", {"testvendor": mock_fn}),
        patch(f"{_MODULE}.load_dynasent_split", side_effect=[FAKE_R1, FAKE_R2]),
        patch(f"{_MODULE}.SAMPLE_SIZE", 200),
    ):
        resp1 = await client.post("/eval/sentiment", json=payload)
        assert resp1.status_code == 200
        assert resp1.json()["source"] == "live_inference_v1"
        call_count_after_first = mock_fn.call_count

    # Second call — vendor fn should NOT be called again
    with (
        patch(f"{_MODULE}.VENDOR_REGISTRY", {"testvendor": mock_fn}),
        patch(f"{_MODULE}.load_dynasent_split", side_effect=[FAKE_R1, FAKE_R2]),
        patch(f"{_MODULE}.SAMPLE_SIZE", 200),
    ):
        resp2 = await client.post("/eval/sentiment", json=payload)

    assert resp2.status_code == 200
    assert resp2.json()["source"] == "cached_v1"
    # vendor fn was not called again
    assert mock_fn.call_count == call_count_after_first


# ---------------------------------------------------------------------------
# e) test_parse_label
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "raw,expected",
    [
        ("positive.", "positive"),
        ("NEGATIVE", "negative"),
        ("I think it is neutral here", "neutral"),
        ("asdf gibberish 12345", None),
    ],
)
def test_parse_label(raw: str, expected: str | None):
    assert _parse_label(raw) == expected


# ---------------------------------------------------------------------------
# Bonus: test cache clear endpoint
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_cache_clear(client: AsyncClient):
    resp = await client.post("/eval/cache/clear")
    assert resp.status_code == 200
    assert "deleted" in resp.json()
