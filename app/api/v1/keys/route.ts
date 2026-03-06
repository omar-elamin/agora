import { NextResponse } from "next/server";
import { generateApiKey } from "@/lib/auth";
import { kv } from "@/lib/kv";

export async function POST() {
  const api_key = generateApiKey();
  const created_at = new Date().toISOString();

  await kv.set(`apikey:${api_key}`, "1");

  return NextResponse.json({ api_key, created_at });
}
