/** TypeScript interfaces mirroring agora/eval/calibration/types.py */

export interface PredictionRecord {
  example_id: string;
  vendor_id: string;
  predicted_label: string;
  ground_truth_label: string;
  confidence: number;
  full_probs: Record<string, number> | null;
  task_category: string;
  eval_date: string;
  model_version?: string | null;
  confidence_available: boolean;
}

export interface BinStats {
  bin_index: number;
  lower: number;
  upper: number;
  count: number;
  mean_conf: number;
  accuracy: number;
  gap: number;
}

export interface CalibrationResult {
  vendor_id: string;
  task_category: string;
  eval_date: string;
  n_total: number;
  n_bins: number;
  bins: BinStats[];
  ece: number | null;
  mce: number | null;
  brier_score: number | null;
  label: string;
  label_color: string;
}

export interface FDSResult {
  vendor_id: string;
  task_category: string;
  eval_date: string;
  n_errors: number;
  n_detectable: number;
  n_high_conf_errors: number;
  n_invisible: number;
  fds_overall: number;
  fds_high_confidence: number;
  invisible_failure_rate: number;
  probe_details: Record<string, number>;
  vendors_in_comparison: string[];
  high_conf_threshold: number;
  fds_by_category: Record<string, number>;
}

export interface TrustScoreResult {
  vendor_id: string;
  task_category: string;
  eval_date: string;
  accuracy: number;
  ece: number;
  fds_overall: number;
  invisible_failure_rate: number;
  trust_score: number;
  component_breakdown: Record<string, number>;
  label: string;
}

export interface VendorCalibrationReport {
  vendor_id: string;
  task_category: string;
  eval_date: string;
  calibration: CalibrationResult;
  fds: FDSResult | null;
  trust_score: TrustScoreResult | null;
  reliability_diagram_path: string | null;
  metadata: Record<string, unknown>;
}
