export type CqsTier = "high" | "moderate" | "low" | "unknown";

export interface AccentGroupData {
  accent: string;
  wer: number;
  ece: number;
  cqs: CqsTier;
  clips: number;
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
