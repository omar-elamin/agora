import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { validateApiKey } from "@/lib/auth";
import type { OodReportData } from "@/app/types/ood-report";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: Omit<OodReportData, "ownerApiKey">;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.reportTitle || !body.evalType) {
    return NextResponse.json(
      { error: "Missing required fields: reportTitle, evalType" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();

  const report: OodReportData = {
    ...body,
    ownerApiKey: apiKey!,
  };

  await kv.set(`ood-report:${id}`, report);

  return NextResponse.json({ id, url: `/reports/${id}` }, { status: 201 });
}
