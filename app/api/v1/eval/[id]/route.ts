import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/auth";
import { kv } from "@/lib/kv";
import { corsJson, corsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = req.headers.get("x-api-key");
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return corsJson({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;
  const result = await kv.get(`eval:${id}`);

  if (!result) {
    return corsJson({ error: "Eval not found" }, { status: 404 });
  }

  return corsJson(result);
}
