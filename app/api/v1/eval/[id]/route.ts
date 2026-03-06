import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await kv.get(`eval:${id}`);

  if (!result) {
    return NextResponse.json({ error: "Eval not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
