"""Stereo-to-mono audio split pipeline for AssemblyAI Arabic support.

AAI's dual_channel mode applies a single language_code to BOTH channels.
For bilingual calls (English rep + Arabic customer), we must split stereo
audio into two mono files, submit each separately with the correct language
config, then merge the results into a unified timeline.

Requires: ffmpeg on PATH, assemblyai Python SDK, ASSEMBLYAI_API_KEY env var.
"""

import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _probe_channels(input_path: str) -> int:
    """Return the number of audio channels using ffprobe.

    Args:
        input_path: Path to the audio file.

    Returns:
        Number of channels (e.g. 1 for mono, 2 for stereo).

    Raises:
        FileNotFoundError: If ffprobe is not found on PATH.
        RuntimeError: If ffprobe fails to read the file.
    """
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-select_streams", "a:0",
                "-show_entries", "stream=channels",
                "-of", "json",
                input_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except FileNotFoundError:
        raise FileNotFoundError("ffprobe not found on PATH — install ffmpeg")
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"ffprobe failed for {input_path}: {exc.stderr.strip()}") from exc

    data = json.loads(result.stdout)
    streams = data.get("streams", [])
    if not streams:
        raise RuntimeError(f"No audio streams found in {input_path}")
    return int(streams[0]["channels"])


def split_stereo_to_mono(input_path: str, output_dir: str) -> Tuple[str, str]:
    """Split a stereo audio file into two mono WAV files (left/right channels).

    Uses ffmpeg to extract CH1 (left) and CH2 (right) into separate mono WAVs.

    Args:
        input_path: Path to a stereo audio file (WAV or any ffmpeg-compatible format).
        output_dir: Directory to write the output mono WAV files.

    Returns:
        Tuple of (ch1_path, ch2_path) — paths to the left and right channel WAVs.

    Raises:
        FileNotFoundError: If input_path does not exist or ffmpeg is not on PATH.
        ValueError: If input audio is not stereo (must have exactly 2 channels).
        RuntimeError: If ffmpeg fails during the split.
    """
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    channels = _probe_channels(input_path)
    if channels != 2:
        raise ValueError(
            f"Expected stereo audio (2 channels), got {channels} channel(s) in {input_path}"
        )

    basename = Path(input_path).stem
    ch1_path = os.path.join(output_dir, f"{basename}_ch1.wav")
    ch2_path = os.path.join(output_dir, f"{basename}_ch2.wav")

    os.makedirs(output_dir, exist_ok=True)

    # Extract left channel (CH1)
    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", input_path,
                "-filter_complex", "channelsplit=channel_layout=stereo:channels=FL[left]",
                "-map", "[left]",
                "-acodec", "pcm_s16le",
                ch1_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except FileNotFoundError:
        raise FileNotFoundError("ffmpeg not found on PATH — install ffmpeg")
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"ffmpeg CH1 extraction failed: {exc.stderr.strip()}") from exc

    # Extract right channel (CH2)
    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", input_path,
                "-filter_complex", "channelsplit=channel_layout=stereo:channels=FR[right]",
                "-map", "[right]",
                "-acodec", "pcm_s16le",
                ch2_path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"ffmpeg CH2 extraction failed: {exc.stderr.strip()}") from exc

    logger.info(
        "split_stereo_to_mono complete",
        extra={"input": input_path, "ch1": ch1_path, "ch2": ch2_path},
    )
    return ch1_path, ch2_path


def submit_split_channels(
    ch1_path: str,
    ch2_path: str,
    ch1_language: str = "en",
    ch2_language_detection: bool = True,
    ch2_language_code: Optional[str] = None,
) -> Tuple[dict, dict]:
    """Submit two mono channel files to AssemblyAI with independent language configs.

    CH1 (rep) is submitted with a fixed language_code (default 'en').
    CH2 (customer) uses automatic language detection, or a specific language_code
    if provided via ch2_language_code.

    Args:
        ch1_path: Path to the CH1 (left/rep) mono WAV.
        ch2_path: Path to the CH2 (right/customer) mono WAV.
        ch1_language: Language code for CH1 transcription.
        ch2_language_detection: Whether to enable auto language detection for CH2.
        ch2_language_code: If set, overrides ch2_language_detection with this code.

    Returns:
        Tuple of (ch1_transcript_dict, ch2_transcript_dict) with keys:
        utterances, text, confidence, language_code.

    Raises:
        RuntimeError: If ASSEMBLYAI_API_KEY is not set or transcription fails.
    """
    import assemblyai as aai

    api_key = os.environ.get("ASSEMBLYAI_API_KEY")
    if not api_key:
        raise RuntimeError("ASSEMBLYAI_API_KEY environment variable is not set")
    aai.settings.api_key = api_key

    transcriber = aai.Transcriber()

    # CH1: fixed language
    ch1_config = aai.TranscriptionConfig(language_code=ch1_language)
    logger.info("Submitting CH1", extra={"path": ch1_path, "language_code": ch1_language})
    ch1_transcript = transcriber.transcribe(ch1_path, config=ch1_config)

    if ch1_transcript.status == aai.TranscriptStatus.error:
        raise RuntimeError(f"CH1 transcription failed: {ch1_transcript.error}")

    # CH2: auto-detect or specific language
    if ch2_language_code is not None:
        ch2_config = aai.TranscriptionConfig(language_code=ch2_language_code)
        logger.info("Submitting CH2", extra={"path": ch2_path, "language_code": ch2_language_code})
    else:
        ch2_config = aai.TranscriptionConfig(language_detection=ch2_language_detection)
        logger.info("Submitting CH2", extra={"path": ch2_path, "language_detection": ch2_language_detection})
    ch2_transcript = transcriber.transcribe(ch2_path, config=ch2_config)

    if ch2_transcript.status == aai.TranscriptStatus.error:
        raise RuntimeError(f"CH2 transcription failed: {ch2_transcript.error}")

    def _transcript_to_dict(transcript: aai.Transcript) -> dict:
        utterances = []
        for u in (transcript.utterances or []):
            utterances.append({
                "start": u.start,
                "end": u.end,
                "text": u.text,
                "confidence": u.confidence,
            })
        return {
            "utterances": utterances,
            "text": transcript.text or "",
            "confidence": transcript.confidence,
            "language_code": getattr(transcript, "language_code", None),
        }

    return _transcript_to_dict(ch1_transcript), _transcript_to_dict(ch2_transcript)


def merge_transcripts(
    ch1_result: dict,
    ch2_result: dict,
    ch1_label: str = "rep",
    ch2_label: str = "customer",
) -> List[dict]:
    """Merge utterances from two single-channel transcripts into a unified timeline.

    Args:
        ch1_result: Transcript dict from CH1 (as returned by submit_split_channels).
        ch2_result: Transcript dict from CH2.
        ch1_label: Speaker label for CH1 utterances.
        ch2_label: Speaker label for CH2 utterances.

    Returns:
        List of utterance dicts sorted by start_ms, each containing:
        speaker, start_ms, end_ms, text, confidence.
    """
    merged: List[dict] = []

    for utterance in ch1_result.get("utterances", []):
        merged.append({
            "speaker": ch1_label,
            "start_ms": utterance["start"],
            "end_ms": utterance["end"],
            "text": utterance["text"],
            "confidence": utterance["confidence"],
        })

    for utterance in ch2_result.get("utterances", []):
        merged.append({
            "speaker": ch2_label,
            "start_ms": utterance["start"],
            "end_ms": utterance["end"],
            "text": utterance["text"],
            "confidence": utterance["confidence"],
        })

    merged.sort(key=lambda u: u["start_ms"])

    logger.info(
        "merge_transcripts complete",
        extra={
            "ch1_utterances": len(ch1_result.get("utterances", [])),
            "ch2_utterances": len(ch2_result.get("utterances", [])),
            "total_merged": len(merged),
        },
    )
    return merged


def run_split_pipeline(
    input_path: str,
    output_dir: Optional[str] = None,
    ch1_language: str = "en",
    ch2_language_detection: bool = True,
) -> List[dict]:
    """End-to-end stereo split pipeline: split -> submit -> merge -> return.

    Splits stereo audio into two mono channels, submits each to AssemblyAI
    with independent language configs, and merges results into a single timeline.

    Args:
        input_path: Path to the stereo audio file.
        output_dir: Directory for intermediate mono WAVs. If None, uses a temp dir
                     that is cleaned up after the pipeline completes.
        ch1_language: Language code for CH1 (rep channel). Default 'en'.
        ch2_language_detection: Enable auto language detection for CH2.

    Returns:
        Merged list of utterance dicts sorted by start_ms.
    """
    auto_cleanup = output_dir is None
    if auto_cleanup:
        output_dir = tempfile.mkdtemp(prefix="agora_split_")
        logger.info("Using temp output dir", extra={"output_dir": output_dir})

    try:
        ch1_path, ch2_path = split_stereo_to_mono(input_path, output_dir)

        ch1_result, ch2_result = submit_split_channels(
            ch1_path,
            ch2_path,
            ch1_language=ch1_language,
            ch2_language_detection=ch2_language_detection,
        )

        return merge_transcripts(ch1_result, ch2_result)
    finally:
        if auto_cleanup:
            shutil.rmtree(output_dir, ignore_errors=True)
            logger.info("Cleaned up temp dir", extra={"output_dir": output_dir})
