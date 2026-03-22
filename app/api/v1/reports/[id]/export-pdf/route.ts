import { NextRequest } from "next/server";
import { kv } from "@/lib/kv";
import { validateApiKey } from "@/lib/auth";
import type { OodReportData } from "@/app/types/ood-report";
import puppeteer from "puppeteer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const apiKey = req.headers.get("x-agora-key");
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;

  const report = (await kv.get(`ood-report:${id}`)) as OodReportData | null;
  if (!report) {
    return new Response(JSON.stringify({ error: "Report not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (report.ownerApiKey !== apiKey) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    page.setExtraHTTPHeaders({ "x-agora-key": apiKey });
    await page.goto(`${baseUrl}/reports/${id}`, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true });

    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="agora-report-${id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF export failed:", err);
    return new Response(
      JSON.stringify({ error: "PDF generation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
