import { execSync } from "child_process";
import path from "path";
import type {
  PredictionRecord,
  VendorCalibrationReport,
} from "./calibration-types";

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "public", "calibration-output");

/**
 * Run the Phase 1 calibration pipeline for a single vendor by invoking
 * the Python calibration_pipeline via a child process.
 */
export function runCalibration(
  vendorId: string,
  predictions: PredictionRecord[],
  allPredictions: Record<string, PredictionRecord[]>,
  outputDir: string = DEFAULT_OUTPUT_DIR,
): VendorCalibrationReport {
  const payload = JSON.stringify({
    vendor_id: vendorId,
    predictions,
    all_predictions: allPredictions,
    output_dir: outputDir,
  });

  const pythonScript = `
import sys, json
from dataclasses import asdict
from agora.eval.calibration.calibration_pipeline import run_calibration_pipeline
from agora.eval.calibration.types import PredictionRecord

data = json.load(sys.stdin)
vendor_id = data["vendor_id"]
output_dir = data["output_dir"]

predictions = [
    PredictionRecord(**p) for p in data["predictions"]
]

all_preds = {}
for vid, plist in data["all_predictions"].items():
    all_preds[vid] = [PredictionRecord(**p) for p in plist]

task_category = predictions[0].task_category if predictions else "asr"

report = run_calibration_pipeline(
    vendor_id=vendor_id,
    task_category=task_category,
    predictions=predictions,
    all_vendor_predictions=all_preds,
    output_dir=output_dir,
)

print(json.dumps(asdict(report)))
`.trim();

  const stdout = execSync(`python3 -c ${JSON.stringify(pythonScript)}`, {
    input: payload,
    encoding: "utf-8",
    env: { ...process.env, PYTHONPATH: process.cwd() },
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return JSON.parse(stdout) as VendorCalibrationReport;
}
