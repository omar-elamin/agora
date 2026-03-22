/**
 * Unit tests for the AssemblyAI language_code routing guard.
 *
 * Run with: npx tsx tests/probe/assemblyai-language-guard.test.ts
 */

import {
  detectLanguageRoutingFailure,
  ASSEMBLYAI_FAILING_LANGUAGES,
  ENGLISH_LANGUAGE_CODES,
} from "../../lib/assemblyai-language-guard";

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

section("Constants");

assert(ASSEMBLYAI_FAILING_LANGUAGES.includes("ar"), "ar in failing languages");
assert(ASSEMBLYAI_FAILING_LANGUAGES.includes("ko"), "ko in failing languages");
assert(ASSEMBLYAI_FAILING_LANGUAGES.includes("ja"), "ja in failing languages");
assert(ENGLISH_LANGUAGE_CODES.includes("en"), "en in English codes");
assert(ENGLISH_LANGUAGE_CODES.includes("en_us"), "en_us in English codes");
assert(ENGLISH_LANGUAGE_CODES.includes("en-us"), "en-us in English codes");

// ---------------------------------------------------------------------------
// Non-AssemblyAI vendor → no-op
// ---------------------------------------------------------------------------

section("Non-AssemblyAI vendors");

{
  const r = detectLanguageRoutingFailure({ vendor: "deepgram", language_code: "ar" });
  assert(r.is_failure === false, "Deepgram with ar → not a failure");
  assert(r.recommended_vendor === null, "No recommended vendor for non-AAI");
}

{
  const r = detectLanguageRoutingFailure({ vendor: "whisper-large-v3", language_code: "ko" });
  assert(r.is_failure === false, "Whisper with ko → not a failure");
}

// ---------------------------------------------------------------------------
// AssemblyAI with English language_code → no failure
// ---------------------------------------------------------------------------

section("AssemblyAI English language codes");

for (const code of ["en", "en_us", "en-us", "EN", "En_US"]) {
  const r = detectLanguageRoutingFailure({ vendor: "assemblyai", language_code: code });
  assert(r.is_failure === false, `AAI with '${code}' → no failure`);
}

// ---------------------------------------------------------------------------
// AssemblyAI with null/undefined/empty language_code → no failure
// ---------------------------------------------------------------------------

section("AssemblyAI missing language_code");

{
  const r = detectLanguageRoutingFailure({ vendor: "assemblyai" });
  assert(r.is_failure === false, "AAI with undefined language_code → no failure");
}

{
  const r = detectLanguageRoutingFailure({ vendor: "assemblyai", language_code: null });
  assert(r.is_failure === false, "AAI with null language_code → no failure");
}

{
  const r = detectLanguageRoutingFailure({ vendor: "assemblyai", language_code: "" });
  assert(r.is_failure === false, "AAI with empty language_code → no failure");
}

// ---------------------------------------------------------------------------
// AssemblyAI with known-failing language codes → failure
// ---------------------------------------------------------------------------

section("AssemblyAI known-failing languages");

for (const code of ["ar", "ko", "ja"]) {
  const r = detectLanguageRoutingFailure({ vendor: "assemblyai", language_code: code });
  assert(r.is_failure === true, `AAI with '${code}' → failure detected`);
  assert(r.detected_language === code, `Detected language is '${code}'`);
  assert(r.recommended_vendor === "deepgram_nova3", `Recommends deepgram_nova3 for '${code}'`);
  assert(r.reason.includes("known-failing"), `Reason mentions known-failing for '${code}'`);
}

// ---------------------------------------------------------------------------
// AssemblyAI with unknown non-English language code → failure (general)
// ---------------------------------------------------------------------------

section("AssemblyAI unknown non-English language");

{
  const r = detectLanguageRoutingFailure({ vendor: "assemblyai", language_code: "fr" });
  assert(r.is_failure === true, "AAI with 'fr' → failure detected");
  assert(r.detected_language === "fr", "Detected language is 'fr'");
  assert(r.recommended_vendor === "deepgram_nova3", "Recommends deepgram_nova3");
  assert(r.reason.includes("non-English"), "Reason mentions non-English");
}

// ---------------------------------------------------------------------------
// assemblyai_universal2 vendor alias
// ---------------------------------------------------------------------------

section("assemblyai_universal2 alias");

{
  const r = detectLanguageRoutingFailure({ vendor: "assemblyai_universal2", language_code: "ar" });
  assert(r.is_failure === true, "assemblyai_universal2 with 'ar' → failure");
  assert(r.recommended_vendor === "deepgram_nova3", "Recommends deepgram_nova3");
}

{
  const r = detectLanguageRoutingFailure({ vendor: "assemblyai_universal2", language_code: "en" });
  assert(r.is_failure === false, "assemblyai_universal2 with 'en' → no failure");
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
