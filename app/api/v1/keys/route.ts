import { generateApiKey } from "@/lib/auth";
import { kv } from "@/lib/kv";
import { corsJson, corsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST() {
  const api_key = generateApiKey();
  const created_at = new Date().toISOString();

  await kv.set(`apikey:${api_key}`, { active: true, created_at });

  return corsJson({ api_key, created_at });
}
