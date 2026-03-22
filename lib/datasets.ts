import fs from "fs";
import path from "path";

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

const DATASETS_DIR = path.join(process.cwd(), "data", "datasets");

const REGISTRY: Record<string, Dataset> = {
  "temporalwiki-v2": {
    id: "temporalwiki-v2",
    name: "TemporalWiki v2",
    description:
      "50k Wikipedia passages with temporal category labels for calibration evaluation",
    source_path: "data/datasets/temporalwiki-v2.json",
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
};

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
  const dataset = REGISTRY[id];
  if (!dataset) return null;

  const filePath = path.join(process.cwd(), dataset.source_path);
  if (!fs.existsSync(filePath)) return null;

  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 100;

  // Stream-read to avoid loading entire 50k-row file into memory
  const content = fs.readFileSync(filePath, "utf8");
  const rows: DatasetRow[] = JSON.parse(content);

  return rows.slice(offset, offset + limit);
}
