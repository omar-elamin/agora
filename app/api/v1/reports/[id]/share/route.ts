import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { validateApiKey } from "@/lib/auth";
import type { OodReportData } from "@/app/types/ood-report";

interface ShareTokenRecord {
  reportId: string;
  createdAt: number;
  expiresAt: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const apiKey = req.headers.get("x-api-key");
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  const report = (await kv.get(`ood-report:${id}`)) as OodReportData | null;
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.ownerApiKey !== apiKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = crypto.randomUUID();
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  const record: ShareTokenRecord = {
    reportId: id,
    createdAt: now,
    expiresAt: now + sevenDays,
  };

  await kv.set(`share-token:${token}`, record);

  const expiresAt = new Date(record.expiresAt).toISOString();

  return NextResponse.json(
    { token, url: `/reports/shared/${token}`, expiresAt },
    { status: 201 },
  );
}
