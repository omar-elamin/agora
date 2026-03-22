"""Tests for the FiQA Sentiment loader."""

from __future__ import annotations

import warnings
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from agora.loaders.fiqa_sentiment import (
    EXPECTED_SCORE_FIELD,
    EXPECTED_TEXT_FIELD,
    LABEL_MAP,
    _validate_schema,
    load_fiqa_sentiment,
    score_to_label,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_fake_dataset(examples: list[dict], column_names: list[str] | None = None):
    """Return a list-like object that mimics a HuggingFace Dataset."""
    if column_names is None:
        column_names = list(examples[0].keys()) if examples else []

    class FakeDataset(list):
        pass

    ds = FakeDataset(examples)
    ds.column_names = column_names
    return ds


# ---------------------------------------------------------------------------
# score_to_label
# ---------------------------------------------------------------------------

class TestScoreToLabel:
    def test_positive(self):
        assert score_to_label(0.5) == "positive"
        assert score_to_label(0.001) == "positive"
        assert score_to_label(1.0) == "positive"

    def test_negative(self):
        assert score_to_label(-0.5) == "negative"
        assert score_to_label(-0.001) == "negative"
        assert score_to_label(-1.0) == "negative"

    def test_neutral(self):
        assert score_to_label(0.0) == "neutral"


# ---------------------------------------------------------------------------
# Thresholding → integer labels
# ---------------------------------------------------------------------------

class TestThresholding:
    @patch("agora.loaders.fiqa_sentiment.load_dataset")
    def test_positive_score_maps_to_0(self, mock_load):
        mock_load.return_value = _make_fake_dataset(
            [{"sentence": "good", "score": 0.8}],
        )
        _, labels, _ = load_fiqa_sentiment()
        assert labels == [LABEL_MAP["positive"]]

    @patch("agora.loaders.fiqa_sentiment.load_dataset")
    def test_negative_score_maps_to_1(self, mock_load):
        mock_load.return_value = _make_fake_dataset(
            [{"sentence": "bad", "score": -0.6}],
        )
        _, labels, _ = load_fiqa_sentiment()
        assert labels == [LABEL_MAP["negative"]]

    @patch("agora.loaders.fiqa_sentiment.load_dataset")
    def test_zero_score_maps_to_2(self, mock_load):
        mock_load.return_value = _make_fake_dataset(
            [{"sentence": "meh", "score": 0.0}],
        )
        _, labels, _ = load_fiqa_sentiment()
        assert labels == [LABEL_MAP["neutral"]]


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

class TestSchemaValidation:
    def test_missing_text_field(self):
        ds = _make_fake_dataset(
            [{"wrong_name": "hi", "score": 0.1}],
            column_names=["wrong_name", "score"],
        )
        with pytest.raises(ValueError, match="sentence"):
            _validate_schema(ds)

    def test_missing_score_field(self):
        ds = _make_fake_dataset(
            [{"sentence": "hi", "wrong_name": 0.1}],
            column_names=["sentence", "wrong_name"],
        )
        with pytest.raises(ValueError, match="score"):
            _validate_schema(ds)

    def test_non_numeric_score(self):
        ds = _make_fake_dataset(
            [{"sentence": "hi", "score": "not-a-number"}],
        )
        with pytest.raises(TypeError, match="numeric"):
            _validate_schema(ds)

    def test_valid_schema_passes(self):
        ds = _make_fake_dataset([{"sentence": "hi", "score": 0.5}])
        _validate_schema(ds)  # should not raise


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------

class TestMetadata:
    @patch("agora.loaders.fiqa_sentiment.load_dataset")
    def test_metadata_keys(self, mock_load):
        mock_load.return_value = _make_fake_dataset([
            {"sentence": "a", "score": 0.5},
            {"sentence": "b", "score": -0.3},
        ])
        _, _, meta = load_fiqa_sentiment(split="train")
        expected_keys = {
            "n", "split", "class_counts", "class_ratios",
            "imbalance_ratio", "imbalance_flag", "raw_scores",
        }
        assert set(meta.keys()) == expected_keys

    @patch("agora.loaders.fiqa_sentiment.load_dataset")
    def test_metadata_values(self, mock_load):
        mock_load.return_value = _make_fake_dataset([
            {"sentence": "a", "score": 0.5},
            {"sentence": "b", "score": -0.3},
            {"sentence": "c", "score": 0.0},
        ])
        _, _, meta = load_fiqa_sentiment(split="test")
        assert meta["n"] == 3
        assert meta["split"] == "test"
        assert meta["class_counts"] == {0: 1, 1: 1, 2: 1}
        assert meta["raw_scores"] == [0.5, -0.3, 0.0]

    @patch("agora.loaders.fiqa_sentiment.load_dataset")
    def test_class_ratios_sum_to_one(self, mock_load):
        mock_load.return_value = _make_fake_dataset([
            {"sentence": "a", "score": 0.1},
            {"sentence": "b", "score": -0.2},
            {"sentence": "c", "score": 0.3},
            {"sentence": "d", "score": -0.4},
        ])
        _, _, meta = load_fiqa_sentiment()
        assert abs(sum(meta["class_ratios"].values()) - 1.0) < 1e-9


# ---------------------------------------------------------------------------
# Imbalance flag
# ---------------------------------------------------------------------------

class TestImbalanceFlag:
    @patch("agora.loaders.fiqa_sentiment.load_dataset")
    def test_balanced_no_flag(self, mock_load):
        mock_load.return_value = _make_fake_dataset([
            {"sentence": "a", "score": 0.5},
            {"sentence": "b", "score": -0.3},
        ])
        _, _, meta = load_fiqa_sentiment()
        assert meta["imbalance_flag"] is False

    @patch("agora.loaders.fiqa_sentiment.load_dataset")
    def test_imbalanced_sets_flag(self, mock_load):
        examples = [{"sentence": f"pos{i}", "score": 0.5} for i in range(10)]
        examples.append({"sentence": "neg", "score": -0.1})
        mock_load.return_value = _make_fake_dataset(examples)
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            _, _, meta = load_fiqa_sentiment()
        assert meta["imbalance_flag"] is True
        assert any("imbalance" in str(warning.message).lower() for warning in w)


# ---------------------------------------------------------------------------
# Split passthrough
# ---------------------------------------------------------------------------

class TestSplitPassthrough:
    @patch("agora.loaders.fiqa_sentiment.load_dataset")
    def test_split_forwarded(self, mock_load):
        mock_load.return_value = _make_fake_dataset([
            {"sentence": "a", "score": 0.1},
        ])
        for split in ("train", "test", "validation"):
            load_fiqa_sentiment(split=split)
            _, kwargs = mock_load.call_args
            assert kwargs["split"] == split
