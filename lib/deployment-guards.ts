import type { DeploymentGuardCallout, SilentFailureRisk } from "@/app/types/cqs";

export function computeDeploymentGuards(
  vendor: string,
  silentFailureRisk: SilentFailureRisk,
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
