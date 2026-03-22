import fs from "fs";
import path from "path";
import os from "os";

export interface Dataset {
  id: string;
  name: string;
  description: string;
  source_path: string;
  row_count: number;
  created_at: string;
  schema: Record<string, string>;
}

export interface DatasetRow {
  text: string;
  label: string;
  split: string;
  temporal_window: string;
  source_article_title: string;
}

export interface DatasetEvalResult {
  dataset: Dataset;
  sample_size: number;
  rows: DatasetRow[];
  label_distribution: Record<string, number>;
  temporal_window_distribution: Record<string, number>;
  split_distribution: Record<string, number>;
  vendor_benchmark?: import("./llm-vendors").VendorBenchmarkResult;
}

// JSONL-backed datasets with absolute paths (may live outside project root)
const JSONL_REGISTRY: Record<string, { dataset: Dataset; jsonl_path: string }> = {
  "temporalwiki-v2": {
    dataset: {
      id: "temporalwiki-v2",
      name: "TemporalWiki v2",
      description:
        "50k Wikipedia passages with temporal category labels for calibration evaluation",
      source_path: path.join(os.homedir(), "Projects/agora-temporalwiki/output_v2/eval_set.jsonl"),
      row_count: 50000,
      created_at: "2026-03-22T00:00:00Z",
      schema: {
        text: "string",
        label: "string",
        split: "string",
        temporal_window: "string",
        source_article_title: "string",
      },
    },
    jsonl_path: path.join(os.homedir(), "Projects/agora-temporalwiki/output_v2/eval_set.jsonl"),
  },
};

const REGISTRY: Record<string, Dataset> = Object.fromEntries(
  Object.entries(JSONL_REGISTRY).map(([id, { dataset }]) => [id, dataset])
);

export function getDataset(id: string): Dataset | null {
  return REGISTRY[id] ?? null;
}

export function listDatasets(): Dataset[] {
  return Object.values(REGISTRY);
}

export function getDatasetRows(
  id: string,
  opts?: { offset?: number; limit?: number }
): DatasetRow[] | null {
  const entry = JSONL_REGISTRY[id];
  if (!entry) return null;

  const filePath = entry.jsonl_path;
  if (!fs.existsSync(filePath)) return null;

  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 100;

  // Read JSONL line-by-line, take slice
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const slice = lines.slice(offset, offset + limit);

  return slice.map((line) => JSON.parse(line) as DatasetRow);
}

export function runDatasetEval(
  id: string,
  opts?: { limit?: number }
): DatasetEvalResult | null {
  const dataset = getDataset(id);
  if (!dataset) return null;

  const limit = opts?.limit ?? 1000;
  const rows = getDatasetRows(id, { offset: 0, limit });
  if (!rows) return null;

  const label_distribution: Record<string, number> = {};
  const temporal_window_distribution: Record<string, number> = {};
  const split_distribution: Record<string, number> = {};

  for (const row of rows) {
    label_distribution[row.label] = (label_distribution[row.label] ?? 0) + 1;
    temporal_window_distribution[row.temporal_window] =
      (temporal_window_distribution[row.temporal_window] ?? 0) + 1;
    split_distribution[row.split] = (split_distribution[row.split] ?? 0) + 1;
  }

  return {
    dataset,
    sample_size: rows.length,
    rows,
    label_distribution,
    temporal_window_distribution,
    split_distribution,
  };
}

export function runDatasetEvalFull(id: string): DatasetEvalResult | null {
  const dataset = getDataset(id);
  if (!dataset) return null;

  const entry = JSONL_REGISTRY[id];
  if (!entry || !fs.existsSync(entry.jsonl_path)) return null;

  const content = fs.readFileSync(entry.jsonl_path, "utf8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const rows = lines.map((line) => JSON.parse(line) as DatasetRow);

  const label_distribution: Record<string, number> = {};
  const temporal_window_distribution: Record<string, number> = {};
  const split_distribution: Record<string, number> = {};

  for (const row of rows) {
    label_distribution[row.label] = (label_distribution[row.label] ?? 0) + 1;
    temporal_window_distribution[row.temporal_window] =
      (temporal_window_distribution[row.temporal_window] ?? 0) + 1;
    split_distribution[row.split] = (split_distribution[row.split] ?? 0) + 1;
  }

  return {
    dataset,
    sample_size: rows.length,
    rows,
    label_distribution,
    temporal_window_distribution,
    split_distribution,
  };
}

export type ProgressCallback = (processed: number, total: number) => void;

export async function runDatasetEvalWithProgress(
  id: string,
  onProgress: ProgressCallback,
): Promise<DatasetEvalResult | null> {
  const dataset = getDataset(id);
  if (!dataset) return null;

  const entry = JSONL_REGISTRY[id];
  if (!entry || !fs.existsSync(entry.jsonl_path)) return null;

  const content = fs.readFileSync(entry.jsonl_path, "utf8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const total = lines.length;

  const rows: DatasetRow[] = [];
  const label_distribution: Record<string, number> = {};
  const temporal_window_distribution: Record<string, number> = {};
  const split_distribution: Record<string, number> = {};

  const BATCH_SIZE = 500;

  for (let i = 0; i < total; i++) {
    const row = JSON.parse(lines[i]) as DatasetRow;
    rows.push(row);

    label_distribution[row.label] = (label_distribution[row.label] ?? 0) + 1;
    temporal_window_distribution[row.temporal_window] =
      (temporal_window_distribution[row.temporal_window] ?? 0) + 1;
    split_distribution[row.split] = (split_distribution[row.split] ?? 0) + 1;

    if ((i + 1) % BATCH_SIZE === 0 || i === total - 1) {
      onProgress(i + 1, total);
      // Yield to event loop so KV writes and other async work can proceed
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return {
    dataset,
    sample_size: rows.length,
    rows,
    label_distribution,
    temporal_window_distribution,
    split_distribution,
  };
}
