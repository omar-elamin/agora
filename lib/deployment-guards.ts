import type { AccentGroupData, DeploymentGuardCallout, EastAsianDeploymentGuidance } from "@/app/types/cqs";

export function computeDeploymentGuards(
  vendor: string,
): DeploymentGuardCallout[] {
  if (vendor === "assemblyai" || vendor === "assemblyai_universal2") {
    return [
      {
        vendor,
        severity: "required",
        guard_type: "confidence_floor",
        affected_languages: ["ja", "ko"],
        threshold: 0.80,
        description:
          "AssemblyAI Universal-2 has ~18% catastrophic failure rate on Japanese and Korean audio due to language detection collapse. Without a confidence floor <= 0.80, these failures pass silently.",
      },
      {
        vendor,
        severity: "recommended",
        guard_type: "language_detection",
        affected_languages: ["ja", "ko"],
        description:
          "Add output language detection guard to catch cases where the transcription language does not match the expected input language. Prevents wrong-language output from reaching downstream consumers.",
      },
    ];
  }

  if (vendor === "deepgram") {
    return [
      {
        vendor,
        severity: "recommended",
        guard_type: "threshold_tuning",
        affected_languages: ["zh", "ja", "ko"],
        threshold: 0.92,
        description:
          "Deepgram Nova-3 exhibits mild overconfidence on East Asian accents. Tune confidence threshold to 0.92 for non-English user bases to reduce silent quality degradation.",
      },
    ];
  }

  if (vendor === "whisper-large-v3") {
    return [];
  }

  // Unknown vendor
  return [
    {
      vendor,
      severity: "required",
      guard_type: "confidence_floor",
      affected_languages: [],
      description:
        "Unknown vendor — no calibration data available. Deploy a confidence floor guard and validate against ground truth before production use.",
    },
  ];
}

export function computeEastAsianGuidance(
  vendor: string,
  accentGroups: AccentGroupData[],
  hasConfidenceData: boolean,
): EastAsianDeploymentGuidance | null {
  if (vendor !== "assemblyai" && vendor !== "assemblyai_universal2") {
    return null;
  }

  const eastAsianPattern = /east asian|japanese|korean/i;
  const hasEastAsianClips = accentGroups.some((g) =>
    eastAsianPattern.test(g.accent),
  );
  if (!hasEastAsianClips) {
    return null;
  }

  const guidance: EastAsianDeploymentGuidance = {
    vendor,
    hasEastAsianClips: true,
    thresholdGuard: {
      required: true,
      threshold: 0.80,
      rationale:
        "~18% catastrophic failure rate on JA/KO clips. korean10 scores 0.75 at 148% WER — a 0.80 threshold catches it with only a 5-point margin.",
    },
    checklist: [
      "Set confidence threshold ≤ 0.80 (not 0.85, not 0.90)",
      "Add character distribution check on output before downstream processing",
      "Log and monitor routing-failure rate by language group",
      "If routing-failure rate > 25%, escalate or evaluate alternatives",
      "Do NOT use Mandarin-only benchmark numbers to justify skipping JA/KO guards",
    ],
  };

  if (hasConfidenceData) {
    guidance.korean10Brittleness = {
      clipId: "korean10",
      confidence: 0.75,
      wer: 148,
      warning:
        "This clip sits 5 points below the 0.80 threshold boundary. Setting threshold to 0.85 would miss it.",
    };
  }

  return guidance;
}
