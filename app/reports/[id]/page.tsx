import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { kv } from "@/lib/kv";
import OodReportView from "@/app/reports/OodReportView";
import type { OodReportData } from "@/app/types/ood-report";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const report = (await kv.get(`ood-report:${id}`)) as OodReportData | null;
  if (!report) {
    return { title: "Report Not Found — Agora" };
  }
  return { title: `Agora Eval Report — ${report.reportTitle}` };
}

function AuthWall({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "420px",
          padding: "48px 32px",
          background: "#1a1d27",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            background: "linear-gradient(135deg, #6c63ff, #00d4aa)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "20px",
            color: "white",
            margin: "0 auto 24px",
          }}
        >
          A
        </div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "12px" }}>{message}</h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
          Include the <code style={{ background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: "4px" }}>x-agora-key</code> header to access this report.
        </p>
      </div>
    </div>
  );
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;

  const report = (await kv.get(`ood-report:${id}`)) as OodReportData | null;
  if (!report) {
    notFound();
  }

  const headerStore = await headers();
  const apiKey = headerStore.get("x-agora-key");

  if (!apiKey) {
    return <AuthWall message="Sign in to view this report" />;
  }

  const keyRecord = await kv.get(`apikey:${apiKey}`);
  if (!keyRecord || report.ownerApiKey !== apiKey) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "420px",
            padding: "48px 32px",
            background: "#1a1d27",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "12px" }}>403 — Forbidden</h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
            You do not have access to this report.
          </p>
        </div>
      </div>
    );
  }

  return <OodReportView data={report} />;
}
