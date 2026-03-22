"use client";

import { useState } from "react";

export default function ShareButton({ reportId }: { reportId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleShare() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/v1/reports/${reportId}/share`, {
        method: "POST",
        headers: { "x-api-key": getApiKey() },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create share link");
      }

      const { url } = await res.json();
      const fullUrl = `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={status === "loading"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 20px",
        background:
          status === "copied"
            ? "linear-gradient(135deg, #00d4aa, #00b894)"
            : status === "error"
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
      {status === "loading" && "Creating link..."}
      {status === "copied" && "Link copied!"}
      {status === "error" && errorMsg}
      {status === "idle" && "Share Report"}
    </button>
  );
}

function getApiKey(): string {
  // The API key is passed via the x-agora-key header for server-rendered pages.
  // For client-side sharing, read from localStorage or cookie if available.
  if (typeof window !== "undefined") {
    return localStorage.getItem("agora-api-key") ?? "";
  }
  return "";
}
