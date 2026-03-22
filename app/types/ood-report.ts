export interface ModelMetrics {
  name: string;
  description: string;
  trainTime: string;
  hardware: string;
  trainAcc: string;
  oodAcc: string;
  delta: string;
  f1Train: string;
  f1Ood: string;
  confTrain: string;
  confOod: string;
  cii: string;
}

export interface CategoryResult {
  name: string;
  trainAcc: string;
  oodAcc: string;
  delta: string;
  notes: string;
  severity: "red" | "orange" | "yellow" | "green";
}

export interface DatasetInfo {
  name: string;
  source: string;
  license: string;
  totalRecords: string;
  dateRange: string;
  task: string;
  inputFormat: string;
}

export interface SplitInfo {
  trainDates: string;
  trainSize: string;
  devDates: string;
  devSize: string;
  oodDates: string;
  oodSize: string;
  cutoff: string;
}

export interface MethodologyParams {
  tfidfFeatures: string;
  logReg: string;
  transformer: string;
  finetune: string;
  calibration: string;
  runEnv: string;
}

export interface OodReportData {
  reportTitle: string;
  evalType: string;
  customerName: string;
  runDate: string;

  execSummary: string;
  dataset: DatasetInfo;
  splits: SplitInfo;

  modelA: ModelMetrics;
  modelB: ModelMetrics;

  oodTestSize: string;

  categories: CategoryResult[];

  driftCurveCaption: string;
  categoryChartCaption: string;

  params: MethodologyParams;

  limitations: {
    testSetSize: string;
    textFormat: string;
    sourceBias: string;
    labelConsistency: string;
    attribution: string;
  };

  contactEmail: string;

  ownerApiKey: string;
}
