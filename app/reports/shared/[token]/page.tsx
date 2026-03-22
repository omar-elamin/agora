import { notFound } from "next/navigation";
import { kv } from "@/lib/kv";
import OodReportView from "@/app/reports/OodReportView";
import type { OodReportData } from "@/app/types/ood-report";
import type { Metadata } from "next";

interface ShareTokenRecord {
  reportId: string;
  createdAt: number;
  expiresAt: number;
}

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const record = (await kv.get(`share-token:${token}`)) as ShareTokenRecord | null;
  if (!record) {
    return { title: "Shared Report — Agora" };
  }
  const report = (await kv.get(`ood-report:${record.reportId}`)) as OodReportData | null;
  if (!report) {
    return { title: "Shared Report — Agora" };
  }
  return { title: `Agora Eval Report — ${report.reportTitle}` };
}

function ExpiredMessage() {
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
        <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "12px" }}>
          Link Expired
        </h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
          This shared report link has expired. Ask the report owner to generate a new one.
        </p>
      </div>
    </div>
  );
}

function SharedBanner() {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1a1d27 0%, #0f1117 100%)",
        borderBottom: "1px solid rgba(108, 99, 255, 0.3)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "24px",
          height: "24px",
          background: "linear-gradient(135deg, #6c63ff, #00d4aa)",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: "12px",
          color: "white",
          flexShrink: 0,
        }}
      >
        A
      </div>
      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
        This report was shared via{" "}
        <a
          href="/"
          style={{
            color: "#6c63ff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Agora
        </a>
        {" "}&mdash; the AI vendor eval platform
      </span>
    </div>
  );
}

export default async function SharedReportPage({ params }: Props) {
  const { token } = await params;

  const record = (await kv.get(`share-token:${token}`)) as ShareTokenRecord | null;
  if (!record) {
    notFound();
  }

  if (record.expiresAt < Date.now()) {
    return <ExpiredMessage />;
  }

  const report = (await kv.get(`ood-report:${record.reportId}`)) as OodReportData | null;
  if (!report) {
    notFound();
  }

  return (
    <>
      <SharedBanner />
      <OodReportView data={report} />
    </>
  );
}
