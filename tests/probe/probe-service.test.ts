/**
 * Unit tests for the language validation probe.
 *
 * Run with: npx tsx tests/probe/probe-service.test.ts
 */

import {
  detectDominantScript,
  scriptMismatch,
  probeLanguage,
  applyConfidenceDemotion,
  normalizeLangCode,
  ProbeService,
  MIN_PROBE_LENGTH,
  STRONG_DEMOTION_FACTOR,
  MEDIUM_DEMOTION_FACTOR,
  MILD_DEMOTION_FACTOR,
  ESCALATION_THRESHOLD,
} from "../../lib/probe-service";
import { computeProbeFDS } from "../../lib/fds";
import type { ProbeEvalItem } from "../../lib/fds";

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

function assertClose(a: number, b: number, epsilon: number, msg: string) {
  assert(Math.abs(a - b) < epsilon, `${msg} — expected ~${b}, got ${a}`);
}

function section(name: string) {
  console.log(`\n--- ${name} ---`);
}

// ---------------------------------------------------------------------------
// Script Check Tests
// ---------------------------------------------------------------------------

section("Script Detection");

assert(detectDominantScript("Hello world this is English text") === "latin", "Latin text detected");
assert(detectDominantScript("Привет мир это русский текст") === "cyrillic", "Cyrillic text detected");
assert(detectDominantScript("これは日本語のテキストです") === "cjk", "CJK (Japanese) text detected");
assert(detectDominantScript("한국어 텍스트입니다") === "cjk", "CJK (Korean) text detected");
assert(detectDominantScript("这是中文文本") === "cjk", "CJK (Chinese) text detected");
assert(detectDominantScript("مرحبا بالعالم") === "arabic", "Arabic text detected");
assert(detectDominantScript("नमस्ते दुनिया") === "devanagari", "Devanagari text detected");
assert(detectDominantScript("שלום עולם") === "hebrew", "Hebrew text detected");
assert(detectDominantScript("123 !!!") === "unknown", "Punctuation-only returns unknown");

section("Script Mismatch");

assert(scriptMismatch("これは日本語です", "en") === true, "CJK transcript vs English declared → mismatch");
assert(scriptMismatch("Hello world", "en") === false, "Latin transcript vs English declared → no mismatch");
assert(scriptMismatch("これは日本語です", "ja") === false, "CJK transcript vs Japanese declared → no mismatch");
assert(scriptMismatch("Привет мир", "en") === true, "Cyrillic vs English → mismatch");
assert(scriptMismatch("Привет мир", "ru") === false, "Cyrillic vs Russian → no mismatch");
assert(scriptMismatch("Hello", "fr") === false, "Latin vs French → no mismatch");

// ---------------------------------------------------------------------------
// Language Probe Tests
// ---------------------------------------------------------------------------

section("Language Probe");

{
  const result = probeLanguage(
    "This is a long enough English text that should be detectable by the language identification system for testing.",
    "en",
  );
  assert(result.result === "agree", `English text agrees with en: got ${result.result}`);
  assert(result.declared_lang === "en", "Declared lang normalized to en");
}

{
  const result = probeLanguage(
    "Dies ist ein ausreichend langer deutscher Text der vom Spracherkennungssystem erkannt werden sollte.",
    "en",
  );
  assert(result.result === "disagree", `German text disagrees with en: got ${result.result}`);
  assert(result.probe_lang !== null, "Probe detected a language");
}

{
  // Short text should still get probed (MIN_PROBE_LENGTH check is in ProbeService, not probeLanguage)
  const result = probeLanguage("Hi", "en");
  // franc may return "und" for very short text
  assert(
    result.result === "agree" || result.result === "disagree" || result.result === "insufficient_text",
    `Short text handled: ${result.result}`,
  );
}

section("Short Text Skip (ProbeService)");

{
  const svc = new ProbeService();
  const { probe } = svc.run("short", "en", 0.85);
  assert(probe.result === "probe_skipped_short", "Text under MIN_PROBE_LENGTH skipped");
  assert(probe.stage_reached === "none", "Stage reached is 'none' for short text");
  assert(probe.demotion_applied === false, "No demotion on short text");
}

// ---------------------------------------------------------------------------
// Confidence Demotion Tests
// ---------------------------------------------------------------------------

section("Confidence Demotion — Agree (no demotion)");

{
  const d = applyConfidenceDemotion(0.85, { result: "agree", probe_confidence: 0.90 });
  assert(d.adjusted_confidence === 0.85, "Confidence unchanged on agree");
  assert(d.demotion_applied === false, "No demotion applied");
  assert(d.probe_verified === true, "Probe verified = true");
  assert(d.escalate_to_audit === false, "No escalation on agree");
}

section("Confidence Demotion — Strong (both high confidence)");

{
  const d = applyConfidenceDemotion(0.90, { result: "disagree", probe_confidence: 0.85 });
  assertClose(d.adjusted_confidence, 0.90 * STRONG_DEMOTION_FACTOR, 0.001,
    "Strong demotion applied");
  assert(d.demotion_applied === true, "Demotion flag set");
  assert(d.demotion_factor === STRONG_DEMOTION_FACTOR, `Factor is ${STRONG_DEMOTION_FACTOR}`);
  assert(d.probe_verified === false, "Not verified");
  assert(d.escalate_to_audit === true, "Escalation triggered");
}

section("Confidence Demotion — Medium (probe >= 0.70)");

{
  const d = applyConfidenceDemotion(0.60, { result: "disagree", probe_confidence: 0.75 });
  assertClose(d.adjusted_confidence, 0.60 * MEDIUM_DEMOTION_FACTOR, 0.001,
    "Medium demotion applied");
  assert(d.demotion_factor === MEDIUM_DEMOTION_FACTOR, `Factor is ${MEDIUM_DEMOTION_FACTOR}`);
  assert(d.escalate_to_audit === false, "No escalation for medium");
}

section("Confidence Demotion — Mild (probe < 0.70)");

{
  const d = applyConfidenceDemotion(0.80, { result: "disagree", probe_confidence: 0.55 });
  assertClose(d.adjusted_confidence, 0.80 * MILD_DEMOTION_FACTOR, 0.001,
    "Mild demotion applied");
  assert(d.demotion_factor === MILD_DEMOTION_FACTOR, `Factor is ${MILD_DEMOTION_FACTOR}`);
  assert(d.escalate_to_audit === false, "No escalation for mild");
}

section("Confidence Demotion — Pass-through (non-agree/disagree)");

{
  const d = applyConfidenceDemotion(0.70, { result: "probe_skipped_short", probe_confidence: null });
  assert(d.adjusted_confidence === 0.70, "Confidence unchanged");
  assert(d.demotion_applied === false, "No demotion");
  assert(d.probe_verified === null, "Probe verified is null (indeterminate)");
}

// ---------------------------------------------------------------------------
// FDS Calculation Tests
// ---------------------------------------------------------------------------

section("FDS Calculation");

{
  const items: ProbeEvalItem[] = [
    { is_correct: false, probe_result: "disagree" },
    { is_correct: false, probe_result: "disagree" },
    { is_correct: false, probe_result: "agree" },
    { is_correct: true, probe_result: "agree" },
    { is_correct: true, probe_result: "agree" },
  ];
  const fds = computeProbeFDS(items);
  assert(fds.total_failures === 3, `Total failures = 3, got ${fds.total_failures}`);
  assert(fds.failures_caught === 2, `Failures caught = 2, got ${fds.failures_caught}`);
  assertClose(fds.fds!, 2 / 3, 0.001, "FDS = 2/3");
}

{
  const items: ProbeEvalItem[] = [
    { is_correct: true, probe_result: "agree" },
    { is_correct: true, probe_result: "agree" },
  ];
  const fds = computeProbeFDS(items);
  assert(fds.total_failures === 0, "No failures");
  assert(fds.fds === null, "FDS is null when no failures");
}

{
  const items: ProbeEvalItem[] = [
    { is_correct: false, probe_result: "script_mismatch" },
    { is_correct: false, probe_result: "agree" },
  ];
  const fds = computeProbeFDS(items);
  assert(fds.failures_caught === 1, "Script mismatch counts as caught");
  assertClose(fds.fds!, 0.5, 0.001, "FDS = 0.5");
}

section("Normalize Language Code");

assert(normalizeLangCode("en-US") === "en", "BCP-47 to ISO 639-1");
assert(normalizeLangCode("eng") === "en", "ISO 639-3 to ISO 639-1");
assert(normalizeLangCode("ja") === "ja", "Already ISO 639-1");
assert(normalizeLangCode("cmn") === "zh", "Mandarin → zh");

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n============================`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`============================\n`);

if (failed > 0) {
  process.exit(1);
}
