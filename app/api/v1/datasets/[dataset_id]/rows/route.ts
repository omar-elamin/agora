import { NextRequest } from "next/server";
import { corsJson, corsOptions } from "@/lib/cors";
import { getDataset, getDatasetRows } from "@/lib/datasets";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dataset_id: string }> }
) {
  const { dataset_id } = await params;
  const dataset = getDataset(dataset_id);
  if (!dataset) {
    return corsJson({ error: `Dataset '${dataset_id}' not found` }, { status: 404 });
  }

  const url = new URL(req.url);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));

  const rows = getDatasetRows(dataset_id, { offset, limit });
  if (!rows) {
    return corsJson(
      { error: "Dataset file not found. Run the seed script first." },
      { status: 500 }
    );
  }

  return corsJson({
    dataset_id,
    offset,
    limit,
    total: dataset.row_count,
    rows,
  });
}
