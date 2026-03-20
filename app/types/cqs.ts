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

export interface DeploymentGuardCallout {
  vendor: string;
  severity: "required" | "recommended";
  guard_type: "confidence_floor" | "language_detection" | "threshold_tuning";
  description: string;
  affected_languages: string[];
  threshold?: number;
}

export interface ProbeOverview {
  adjusted_confidence: number | null;
  probe_fds: number | null;
  probe_result: string | null;
  probe_verified: boolean | null;
  escalate_to_audit: boolean;
}

export interface KnownBehavior {
  id: string;
  vendor: string;
  severity: "critical" | "warning" | "info";
  title: string;
  summary: string;
  detail: string;
  affected_params: string[];
  recommendation: string;
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
