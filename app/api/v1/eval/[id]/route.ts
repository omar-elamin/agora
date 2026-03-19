import { NextRequest } from "next/server";
import { kv } from "@/lib/kv";
import { corsJson, corsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await kv.get(`eval:${id}`);

  if (!result) {
    return corsJson({ error: "Eval not found" }, { status: 404 });
  }

  return corsJson(result);
}
