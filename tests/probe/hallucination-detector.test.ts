/**
 * Unit tests for the Route B hallucination detector.
 *
 * Run with: npx tsx tests/probe/hallucination-detector.test.ts
 */

import {
  HallucinationDetector,
  detectAndQuarantine,
  KNOWN_HALLUCINATION_PHRASES,
} from "../../lib/hallucination-detector";
import type { WhisperResult } from "../../lib/whisper";

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function section(name: string) {
  console.log(`\n--- ${name} ---`);
}

const detector = new HallucinationDetector();

// ---------------------------------------------------------------------------
// H1 – Token Sparsity
// ---------------------------------------------------------------------------

section("H1 – Token Sparsity");

{
  // 60s audio → expected_min = floor(60/60 * 80) = 80
  // threshold = 80 * 0.40 = 32 words
  // 5 words < 32 → TOKEN_SPARSE
  const r = detector.detect("hello world foo bar baz", 60, 0.5);
  assert(r.disposition === "QUARANTINE", "H1: short transcript on 60s audio → quarantine");
  assert(r.flags.includes("TOKEN_SPARSE"), "H1: TOKEN_SPARSE flag present");
}

{
  // audio < 5s → H1 skipped
  const d2 = new HallucinationDetector();
  const r = d2.detect("hi", 3, 0.5);
  assert(!r.flags.includes("TOKEN_SPARSE"), "H1: skipped when audio < 5s");
}

// ---------------------------------------------------------------------------
// H2 – Language Mismatch
// ---------------------------------------------------------------------------

section("H2 – Language Mismatch");

{
  // High ar_confidence but pure English text → no Arabic chars → LANGUAGE_MISMATCH
  const d = new HallucinationDetector();
  const r = d.detect(
    "This is a perfectly normal English sentence with no Arabic characters at all and it keeps going for a while to have enough words",
    30,
    0.92,
  );
  assert(r.flags.includes("LANGUAGE_MISMATCH"), "H2: high ar_confidence + no Arabic → LANGUAGE_MISMATCH");
}

{
  // High ar_confidence WITH Arabic text → no mismatch
  const d = new HallucinationDetector();
  const r = d.detect("مرحبا بالعالم هذا نص عربي طويل بما يكفي", 30, 0.92);
  assert(!r.flags.includes("LANGUAGE_MISMATCH"), "H2: high ar_confidence + Arabic text → no mismatch");
}

// ---------------------------------------------------------------------------
// H3 – Known Hallucination Phrases
// ---------------------------------------------------------------------------

section("H3 – Known Hallucination Phrases");

{
  const d = new HallucinationDetector();
  const r = d.detect("بسم الله الرحمن الرحيم اشتركوا في القناة ونراكم", 10, 0.9);
  assert(r.flags.includes("KNOWN_HALLUCINATION_PHRASE"), "H3: Arabic subscribe phrase → flagged");
}

{
  const d = new HallucinationDetector();
  const r = d.detect("Please subscribe to the channel and like", 10, 0.1);
  assert(r.flags.includes("KNOWN_HALLUCINATION_PHRASE"), "H3: English subscribe phrase → flagged");
}

{
  // Empty output → EMPTY_OUTPUT (H3 variant)
  const d = new HallucinationDetector();
  const r = d.detect("", 10, 0.5);
  assert(r.flags.includes("EMPTY_OUTPUT"), "H3: empty transcript → EMPTY_OUTPUT");
}

// ---------------------------------------------------------------------------
// H4 – Low Word Density
// ---------------------------------------------------------------------------

section("H4 – Low Word Density");

{
  // 30s audio, 4 words → wps = 4/30 ≈ 0.133 < 0.40 → LOW_WORD_DENSITY
  const d = new HallucinationDetector();
  const r = d.detect("hello world foo bar", 30, 0.5);
  assert(r.flags.includes("LOW_WORD_DENSITY"), "H4: 4 words on 30s → LOW_WORD_DENSITY");
}

{
  // audio < 10s → H4 skipped
  const d = new HallucinationDetector();
  const r = d.detect("hello world", 8, 0.5);
  assert(!r.flags.includes("LOW_WORD_DENSITY"), "H4: skipped when audio < 10s");
}

// ---------------------------------------------------------------------------
// H5 – Repetition Loop
// ---------------------------------------------------------------------------

section("H5 – Repetition Loop");

{
  // Build a repeated 5-gram: "the quick brown fox jumps" × 10
  const fivegram = "the quick brown fox jumps";
  const transcript = Array(10).fill(fivegram).join(" ");
  const d = new HallucinationDetector();
  const r = d.detect(transcript, 30, 0.1);
  assert(r.flags.includes("REPETITION_LOOP"), "H5: repeated 5-gram → REPETITION_LOOP");
}

{
  // < 10 words → H5 skipped
  const d = new HallucinationDetector();
  const r = d.detect("one two three four five six", 30, 0.1);
  assert(!r.flags.includes("REPETITION_LOOP"), "H5: skipped when < 10 words");
}

// ---------------------------------------------------------------------------
// Integration: ts_c12 simulation
// ---------------------------------------------------------------------------

section("Integration – ts_c12 scenario");

{
  // 4 Arabic words on real-length audio, ar_conf = 0.962
  // Simulates a real hallucination case
  const d = new HallucinationDetector();
  const r = d.detect("مرحبا بكم أصدقائي", 45, 0.962, "ts_c12");
  assert(r.disposition === "QUARANTINE", "ts_c12: should quarantine");
  // Should hit TOKEN_SPARSE (45s → expected_min=60, threshold=24, 4 < 24 ✓)
  // Should hit LOW_WORD_DENSITY (4/45 = 0.089 < 0.40 ✓)
  // Should NOT hit LANGUAGE_MISMATCH (Arabic text present)
  assert(r.flags.includes("TOKEN_SPARSE"), "ts_c12: TOKEN_SPARSE flag");
  assert(r.flags.includes("LOW_WORD_DENSITY"), "ts_c12: LOW_WORD_DENSITY flag");
  assert(!r.flags.includes("LANGUAGE_MISMATCH"), "ts_c12: no LANGUAGE_MISMATCH (Arabic present)");
  assert(r.quarantine_event !== null, "ts_c12: quarantine event logged");
  assert(r.quarantine_event!.clip_id === "ts_c12", "ts_c12: correct clip_id in event");
}

// ---------------------------------------------------------------------------
// Clean pass
// ---------------------------------------------------------------------------

section("Clean pass – normal transcript");

{
  // A normal-looking transcript: ~2 wps on 30s audio, enough words, no hallucination phrases
  const words = [];
  for (let i = 0; i < 70; i++) words.push("word" + i);
  const transcript = words.join(" ");
  const d = new HallucinationDetector();
  const r = d.detect(transcript, 30, 0.1);
  assert(r.disposition === "PASS", "Clean: normal transcript passes");
  assert(r.flags.length === 0, "Clean: no flags");
  assert(r.quarantine_event === null, "Clean: no quarantine event");
}

// ---------------------------------------------------------------------------
// detectAndQuarantine wrapper
// ---------------------------------------------------------------------------

section("detectAndQuarantine wrapper");

{
  const whisperResult: WhisperResult = {
    transcript: "hello world foo bar baz",
    duration_seconds: 60,
    cost_usd: 0.001,
    latency_ms: 200,
    provider: "groq",
    language: "en",
    language_probability: 0.95,
    segments: [],
    fallback_used: false,
  };
  const dq = detectAndQuarantine(whisperResult, 0.5, "clip_test");
  assert(dq.quarantined === true, "wrapper: sparse transcript quarantined");
  assert(dq.flags.includes("TOKEN_SPARSE"), "wrapper: TOKEN_SPARSE flag");
  assert(typeof dq.metrics.route_b_hallucination_rate === "number", "wrapper: metrics present");
}

// ---------------------------------------------------------------------------
// retryWithPromptPrefix
// ---------------------------------------------------------------------------

section("retryWithPromptPrefix");

{
  const d = new HallucinationDetector();
  const cfg = d.retryWithPromptPrefix({ language: "ar", ar_confidence: 0.95 });
  assert(cfg.initial_prompt.length > 0, "retry: Arabic prompt not empty");
  assert(cfg.language === "ar", "retry: language preserved");

  const cfg2 = d.retryWithPromptPrefix({ language: "en", ar_confidence: 0.3 });
  assert(cfg2.initial_prompt.includes("transcribe accurately"), "retry: English prompt for low ar_conf");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n============================`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`============================\n`);

if (failed > 0) {
  process.exit(1);
}
