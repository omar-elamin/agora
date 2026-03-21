import { describe, it, expect } from "vitest";
import {
  evaluateKoreanRouting,
  KOREAN_CONFIDENCE_THRESHOLD,
} from "../lib/korean-confidence-router";

describe("evaluateKoreanRouting", () => {
  it("flags Korean below threshold for backup routing", () => {
    const result = evaluateKoreanRouting(0.91, "ko");
    expect(result.should_route_to_backup).toBe(true);
    expect(result.confidence).toBe(0.91);
    expect(result.language).toBe("ko");
    expect(result.threshold).toBe(0.964);
    expect(result.reason).toContain("below threshold");
  });

  it("does not flag Korean above threshold", () => {
    const result = evaluateKoreanRouting(0.98, "ko");
    expect(result.should_route_to_backup).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("does not flag non-Korean languages", () => {
    const result = evaluateKoreanRouting(0.5, "en");
    expect(result.should_route_to_backup).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("handles null confidence for Korean", () => {
    const result = evaluateKoreanRouting(null, "ko");
    expect(result.should_route_to_backup).toBe(false);
    expect(result.reason).toBe("no confidence data");
  });

  it("does not flag at exactly the threshold (0.964)", () => {
    const result = evaluateKoreanRouting(0.964, "ko");
    expect(result.should_route_to_backup).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("flags just below threshold", () => {
    const result = evaluateKoreanRouting(0.9639, "ko");
    expect(result.should_route_to_backup).toBe(true);
  });

  it("handles null language", () => {
    const result = evaluateKoreanRouting(0.5, null);
    expect(result.should_route_to_backup).toBe(false);
  });

  it("always returns the correct threshold", () => {
    const result = evaluateKoreanRouting(0.95, "ko");
    expect(result.threshold).toBe(KOREAN_CONFIDENCE_THRESHOLD);
  });
});
