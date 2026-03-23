"""Mid-stream language switch detection for ASR routing.

Uses Unicode script detection (not Whisper's language field) to identify
code-switching events in transcribed segments.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class RoutingMode(Enum):
    """How the router handles detected language switches."""

    STRICT_LOCK = "strict_lock"  # Lock on first segment, never re-evaluate
    ADAPTIVE = "adaptive"  # Re-evaluate and update lock on each segment


@dataclass
class RoutingState:
    """Tracks routing decisions and code-switch events across segments."""

    locked_script: Optional[str] = None
    mode: RoutingMode = RoutingMode.STRICT_LOCK
    code_switch_detected: bool = False
    switch_events: list = field(default_factory=list)


def detect_script(word: str) -> str:
    """Return 'arabic' if word contains Arabic Unicode (U+0600–U+06FF), else 'latin'."""
    for ch in word:
        if "\u0600" <= ch <= "\u06FF":
            return "arabic"
    return "latin"


def _majority_script(words: list[dict]) -> Optional[str]:
    """Return the majority script among a list of word dicts."""
    if not words:
        return None
    counts: dict[str, int] = {}
    for w in words:
        script = detect_script(w["word"])
        counts[script] = counts.get(script, 0) + 1
    return max(counts, key=counts.get)


def process_segment(state: RoutingState, words: list[dict]) -> RoutingState:
    """Process a segment of words, updating routing state with switch detection.

    Args:
        state: Current routing state.
        words: List of word dicts with 'word', 'start', 'end' keys.

    Returns:
        Updated RoutingState.
    """
    if not words:
        return state

    majority = _majority_script(words)

    # First segment: lock on majority script
    if state.locked_script is None:
        state.locked_script = majority

    # Check each word for code-switching
    for w in words:
        script = detect_script(w["word"])
        if script != state.locked_script:
            state.code_switch_detected = True
            state.switch_events.append({
                "word": w["word"],
                "script": script,
                "start": w.get("start"),
                "end": w.get("end"),
            })

    # In adaptive mode, update lock to new majority if a switch was detected
    if state.mode == RoutingMode.ADAPTIVE and state.code_switch_detected:
        state.locked_script = majority

    return state


def route_speaker(
    words: list[dict], mode: RoutingMode = RoutingMode.STRICT_LOCK
) -> RoutingState:
    """Convenience function: process all words as one segment.

    Args:
        words: List of word dicts with 'word', 'start', 'end' keys.
        mode: Routing mode (STRICT_LOCK or ADAPTIVE).

    Returns:
        Final RoutingState after processing.
    """
    state = RoutingState(mode=mode)
    return process_segment(state, words)
