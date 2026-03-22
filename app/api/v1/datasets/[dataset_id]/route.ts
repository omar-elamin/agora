import { NextRequest } from "next/server";
import { corsJson, corsOptions } from "@/lib/cors";
import { getDataset, getDatasetRows } from "@/lib/datasets";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dataset_id: string }> }
) {
  const { dataset_id } = await params;
  const dataset = getDataset(dataset_id);
  if (!dataset) {
    return corsJson({ error: `Dataset '${dataset_id}' not found` }, { status: 404 });
  }

  const sample = getDatasetRows(dataset_id, { limit: 5 });

  return corsJson({ ...dataset, sample_rows: sample ?? [] });
}
