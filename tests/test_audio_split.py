"""Tests for agora.audio_split stereo-to-mono split pipeline."""

import os
import tempfile
import wave
from unittest.mock import MagicMock, patch

import pytest

from agora.audio_split import (
    merge_transcripts,
    run_split_pipeline,
    split_stereo_to_mono,
    submit_split_channels,
)


# --- Fixtures ---


def _make_wav(path: str, n_channels: int = 2, n_frames: int = 8000, sample_rate: int = 16000):
    """Create a synthetic WAV file with the given number of channels."""
    with wave.open(path, "wb") as wf:
        wf.setnchannels(n_channels)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * n_channels * n_frames)


@pytest.fixture
def stereo_wav(tmp_path):
    """Create a stereo WAV file and return its path."""
    path = str(tmp_path / "test_stereo.wav")
    _make_wav(path, n_channels=2)
    return path


@pytest.fixture
def mono_wav(tmp_path):
    """Create a mono WAV file and return its path."""
    path = str(tmp_path / "test_mono.wav")
    _make_wav(path, n_channels=1)
    return path


# --- split_stereo_to_mono tests ---


class TestSplitStereoToMono:
    def test_splits_stereo_into_two_mono_files(self, stereo_wav, tmp_path):
        output_dir = str(tmp_path / "output")
        ch1_path, ch2_path = split_stereo_to_mono(stereo_wav, output_dir)

        assert os.path.isfile(ch1_path)
        assert os.path.isfile(ch2_path)
        assert ch1_path.endswith("_ch1.wav")
        assert ch2_path.endswith("_ch2.wav")

        # Verify both outputs are mono using ffprobe (wave module can't read
        # WAVE_FORMAT_EXTENSIBLE produced by some ffmpeg builds)
        from agora.audio_split import _probe_channels

        assert _probe_channels(ch1_path) == 1
        assert _probe_channels(ch2_path) == 1

    def test_output_filenames_use_input_basename(self, stereo_wav, tmp_path):
        output_dir = str(tmp_path / "output")
        ch1_path, ch2_path = split_stereo_to_mono(stereo_wav, output_dir)

        assert os.path.basename(ch1_path) == "test_stereo_ch1.wav"
        assert os.path.basename(ch2_path) == "test_stereo_ch2.wav"

    def test_mono_input_raises_value_error(self, mono_wav, tmp_path):
        output_dir = str(tmp_path / "output")
        with pytest.raises(ValueError, match="Expected stereo audio"):
            split_stereo_to_mono(mono_wav, output_dir)

    def test_missing_file_raises_file_not_found(self, tmp_path):
        output_dir = str(tmp_path / "output")
        with pytest.raises(FileNotFoundError, match="Input file not found"):
            split_stereo_to_mono("/nonexistent/file.wav", output_dir)

    def test_creates_output_dir_if_missing(self, stereo_wav, tmp_path):
        output_dir = str(tmp_path / "nested" / "output")
        assert not os.path.exists(output_dir)
        ch1_path, _ = split_stereo_to_mono(stereo_wav, output_dir)
        assert os.path.isdir(output_dir)
        assert os.path.isfile(ch1_path)


# --- merge_transcripts tests ---


class TestMergeTranscripts:
    def test_merges_and_sorts_by_start_ms(self):
        ch1 = {
            "utterances": [
                {"start": 0, "end": 1500, "text": "Hello", "confidence": 0.95},
                {"start": 3000, "end": 4500, "text": "How can I help?", "confidence": 0.92},
            ],
        }
        ch2 = {
            "utterances": [
                {"start": 1600, "end": 2800, "text": "مرحبا", "confidence": 0.88},
                {"start": 5000, "end": 6200, "text": "شكرا", "confidence": 0.90},
            ],
        }

        merged = merge_transcripts(ch1, ch2)

        assert len(merged) == 4
        assert [u["start_ms"] for u in merged] == [0, 1600, 3000, 5000]
        assert merged[0]["speaker"] == "rep"
        assert merged[1]["speaker"] == "customer"
        assert merged[2]["speaker"] == "rep"
        assert merged[3]["speaker"] == "customer"

    def test_custom_speaker_labels(self):
        ch1 = {"utterances": [{"start": 0, "end": 100, "text": "Hi", "confidence": 0.9}]}
        ch2 = {"utterances": [{"start": 50, "end": 150, "text": "Hey", "confidence": 0.85}]}

        merged = merge_transcripts(ch1, ch2, ch1_label="agent", ch2_label="caller")

        assert merged[0]["speaker"] == "agent"
        assert merged[1]["speaker"] == "caller"

    def test_empty_utterances(self):
        ch1 = {"utterances": []}
        ch2 = {"utterances": []}
        assert merge_transcripts(ch1, ch2) == []

    def test_missing_utterances_key(self):
        assert merge_transcripts({}, {}) == []

    def test_single_channel_only(self):
        ch1 = {
            "utterances": [
                {"start": 100, "end": 200, "text": "Only rep", "confidence": 0.99},
            ],
        }
        ch2 = {"utterances": []}

        merged = merge_transcripts(ch1, ch2)
        assert len(merged) == 1
        assert merged[0]["speaker"] == "rep"
        assert merged[0]["text"] == "Only rep"

    def test_utterance_fields(self):
        ch1 = {
            "utterances": [
                {"start": 500, "end": 1200, "text": "Test text", "confidence": 0.91},
            ],
        }
        merged = merge_transcripts(ch1, {"utterances": []})

        utterance = merged[0]
        assert utterance == {
            "speaker": "rep",
            "start_ms": 500,
            "end_ms": 1200,
            "text": "Test text",
            "confidence": 0.91,
        }


# --- submit_split_channels tests (mocked AAI SDK) ---


class TestSubmitSplitChannels:
    def _make_mock_transcript(self, utterances, text="", confidence=0.9, status="completed"):
        """Build a mock AAI Transcript object."""
        mock = MagicMock()
        mock.status = status
        mock.error = None
        mock.text = text
        mock.confidence = confidence
        mock.language_code = "en"

        mock_utterances = []
        for u in utterances:
            mu = MagicMock()
            mu.start = u["start"]
            mu.end = u["end"]
            mu.text = u["text"]
            mu.confidence = u["confidence"]
            mock_utterances.append(mu)
        mock.utterances = mock_utterances
        return mock

    @patch.dict(os.environ, {"ASSEMBLYAI_API_KEY": "test-key"})
    def test_submit_returns_transcript_dicts(self):
        """Verify submit_split_channels calls AAI SDK and returns structured dicts."""
        mock_aai = MagicMock()
        mock_transcriber = MagicMock()

        ch1_utterances = [{"start": 0, "end": 1000, "text": "Hello", "confidence": 0.95}]
        ch2_utterances = [{"start": 500, "end": 1500, "text": "مرحبا", "confidence": 0.88}]

        ch1_transcript = self._make_mock_transcript(ch1_utterances, text="Hello", confidence=0.95)
        ch2_transcript = self._make_mock_transcript(ch2_utterances, text="مرحبا", confidence=0.88)
        ch2_transcript.language_code = "ar"

        mock_transcriber.transcribe.side_effect = [ch1_transcript, ch2_transcript]
        mock_aai.Transcriber.return_value = mock_transcriber
        mock_aai.TranscriptStatus.error = "error"

        with patch.dict("sys.modules", {"assemblyai": mock_aai}):
            ch1_result, ch2_result = submit_split_channels("/tmp/ch1.wav", "/tmp/ch2.wav")

        assert len(ch1_result["utterances"]) == 1
        assert ch1_result["utterances"][0]["text"] == "Hello"
        assert len(ch2_result["utterances"]) == 1
        assert ch2_result["utterances"][0]["text"] == "مرحبا"

    def test_missing_api_key_raises(self):
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("ASSEMBLYAI_API_KEY", None)
            mock_aai = MagicMock()
            with patch.dict("sys.modules", {"assemblyai": mock_aai}):
                with pytest.raises(RuntimeError, match="ASSEMBLYAI_API_KEY"):
                    submit_split_channels("/tmp/ch1.wav", "/tmp/ch2.wav")


# --- run_split_pipeline tests (integration, mocked) ---


class TestRunSplitPipeline:
    @patch("agora.audio_split.submit_split_channels")
    @patch("agora.audio_split.split_stereo_to_mono")
    def test_pipeline_orchestration(self, mock_split, mock_submit, tmp_path):
        """Verify the pipeline calls split -> submit -> merge in order."""
        ch1_path = str(tmp_path / "ch1.wav")
        ch2_path = str(tmp_path / "ch2.wav")
        mock_split.return_value = (ch1_path, ch2_path)

        mock_submit.return_value = (
            {
                "utterances": [
                    {"start": 0, "end": 1000, "text": "Hi", "confidence": 0.95},
                ],
            },
            {
                "utterances": [
                    {"start": 500, "end": 1500, "text": "مرحبا", "confidence": 0.88},
                ],
            },
        )

        result = run_split_pipeline("/fake/input.wav", output_dir=str(tmp_path))

        mock_split.assert_called_once_with("/fake/input.wav", str(tmp_path))
        mock_submit.assert_called_once_with(
            ch1_path, ch2_path, ch1_language="en", ch2_language_detection=True,
        )
        assert len(result) == 2
        assert result[0]["start_ms"] == 0
        assert result[1]["start_ms"] == 500

    @patch("agora.audio_split.submit_split_channels")
    @patch("agora.audio_split.split_stereo_to_mono")
    def test_pipeline_uses_tempdir_when_no_output_dir(self, mock_split, mock_submit):
        mock_split.return_value = ("/tmp/ch1.wav", "/tmp/ch2.wav")
        mock_submit.return_value = ({"utterances": []}, {"utterances": []})

        result = run_split_pipeline("/fake/input.wav")
        assert result == []
        # Verify split was called with a temp directory
        call_args = mock_split.call_args
        assert call_args[0][1].startswith(tempfile.gettempdir())
