export type CqsTier = "high" | "moderate" | "low" | "unknown";

export interface AccentGroupData {
  accent: string;
  wer: number;
  ece: number;
  cqs: CqsTier;
  clips: number;
}

export type SilentFailureRating = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CalibrationDirection =
  | "overconfident_mild"
  | "overconfident_dangerous"
  | "underconfident"
  | "unavailable";

export interface SilentFailureRisk {
  rating: SilentFailureRating;
  calibration_direction: CalibrationDirection;
  confidence_at_failure: {
    min: number | null;
    max: number | null;
  } | null;
  recommended_threshold_guard: number | null;
  rationale: string;
}

export interface ModelScorecardData {
  model: string;
  evalDate: string;
  totalClips: number;
  overallWer: number;
  ece: number;
  threshold: number;
  accentGroups: AccentGroupData[];
}
