"""Tests for mid-stream language switch detection in agora.routing."""

from agora.routing import (
    RoutingMode,
    RoutingState,
    detect_script,
    process_segment,
    route_speaker,
)


def _w(word, start=0.0, end=0.5):
    """Helper to build a word dict."""
    return {"word": word, "start": start, "end": end}


class TestDetectScript:
    def test_latin(self):
        assert detect_script("hello") == "latin"

    def test_arabic(self):
        assert detect_script("مرحبا") == "arabic"

    def test_mixed_defaults_arabic(self):
        # A word with at least one Arabic char is classified as arabic
        assert detect_script("hello-مرحبا") == "arabic"

    def test_empty_string(self):
        assert detect_script("") == "latin"


class TestPureEnglish:
    def test_locks_latin_no_switch(self):
        words = [_w("hello", 0, 0.5), _w("world", 0.5, 1.0)]
        state = route_speaker(words)
        assert state.locked_script == "latin"
        assert state.code_switch_detected is False
        assert state.switch_events == []


class TestPureArabic:
    def test_locks_arabic_no_switch(self):
        words = [_w("مرحبا", 0, 0.5), _w("بالعالم", 0.5, 1.0)]
        state = route_speaker(words)
        assert state.locked_script == "arabic"
        assert state.code_switch_detected is False
        assert state.switch_events == []


class TestArabicToEnglishSwitch:
    def test_detects_switch(self):
        """Simulates exp 12 AR→EN code-switching pattern."""
        words = [
            _w("مرحبا", 0, 0.5),
            _w("يا", 0.5, 0.8),
            _w("hello", 0.8, 1.2),
            _w("world", 1.2, 1.6),
        ]
        state = route_speaker(words)
        assert state.locked_script == "arabic"  # majority is arabic (2 vs 2, first wins)
        assert state.code_switch_detected is True
        assert len(state.switch_events) == 2
        assert state.switch_events[0]["word"] == "hello"
        assert state.switch_events[1]["word"] == "world"


class TestAdaptiveMode:
    def test_flips_lock_on_switch(self):
        """ADAPTIVE mode updates locked_script to new majority."""
        # First segment: arabic majority
        words_seg1 = [_w("مرحبا", 0, 0.5), _w("يا", 0.5, 0.8), _w("hello", 0.8, 1.2)]
        state = RoutingState(mode=RoutingMode.ADAPTIVE)
        state = process_segment(state, words_seg1)
        assert state.locked_script == "arabic"
        assert state.code_switch_detected is True

        # Second segment: english majority — lock should flip
        words_seg2 = [_w("the", 1.2, 1.4), _w("test", 1.4, 1.7), _w("works", 1.7, 2.0)]
        state.code_switch_detected = False  # reset for new segment
        state.switch_events.clear()
        state = process_segment(state, words_seg2)
        assert state.locked_script == "latin"
        assert state.code_switch_detected is True


class TestStrictMode:
    def test_keeps_original_lock(self):
        """STRICT_LOCK mode never changes locked_script."""
        # First segment: arabic
        words_seg1 = [_w("مرحبا", 0, 0.5), _w("يا", 0.5, 0.8)]
        state = RoutingState(mode=RoutingMode.STRICT_LOCK)
        state = process_segment(state, words_seg1)
        assert state.locked_script == "arabic"

        # Second segment: english — lock should NOT change
        words_seg2 = [_w("hello", 0.8, 1.2), _w("world", 1.2, 1.6)]
        state = process_segment(state, words_seg2)
        assert state.locked_script == "arabic"
        assert state.code_switch_detected is True
        assert len(state.switch_events) == 2
