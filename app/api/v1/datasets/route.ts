import { corsJson, corsOptions } from "@/lib/cors";
import { listDatasets } from "@/lib/datasets";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET() {
  const datasets = listDatasets();
  return corsJson({ datasets });
}
