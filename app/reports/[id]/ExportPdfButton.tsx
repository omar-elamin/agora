"use client";

import { useState } from "react";

export default function ExportPdfButton({
  reportId,
  apiKey,
}: {
  reportId: string;
  apiKey: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleExport() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/v1/reports/${reportId}/export-pdf`, {
        method: "POST",
        headers: { "x-agora-key": apiKey },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agora-report-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("idle");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <button
      className="no-print"
      onClick={handleExport}
      disabled={status === "loading"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 20px",
        background:
          status === "error"
            ? "linear-gradient(135deg, #ff6b6b, #ee5a5a)"
            : "linear-gradient(135deg, #6c63ff, #5a52e0)",
        color: "white",
        border: "none",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: 600,
        cursor: status === "loading" ? "wait" : "pointer",
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: "all 0.2s ease",
        opacity: status === "loading" ? 0.7 : 1,
      }}
    >
      {status === "loading" && "Generating PDF..."}
      {status === "error" && errorMsg}
      {status === "idle" && "Export PDF"}
    </button>
  );
}
