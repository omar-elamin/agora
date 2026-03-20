"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useRef, useState } from "react";
import ReviewCostCalculator, {
  type ReviewCostValues,
} from "../components/ReviewCostCalculator";

function CalculatorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const initWa = Number(searchParams.get("wa")) || 20;
  const initEa = Number(searchParams.get("ea")) || 5;
  const initEs = Number(searchParams.get("es")) || 5;
  const initAr = Number(searchParams.get("ar")) || 5;
  const initCalls = Number(searchParams.get("calls")) || 1000;
  const initMpr = Number(searchParams.get("mpr")) || 15;
  const initRate = Number(searchParams.get("rate")) || 25;

  const handleChange = useCallback(
    (v: ReviewCostValues) => {
      const params = new URLSearchParams();
      params.set("wa", String(v.pctWa));
      params.set("ea", String(v.pctEa));
      params.set("es", String(v.pctEs));
      params.set("ar", String(v.pctAr));
      params.set("calls", String(v.callsPerDay));
      params.set("mpr", String(v.minutesPerReview));
      params.set("rate", String(v.hourlyRate));
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 800 }}>
        <ReviewCostCalculator
          defaultPctWa={initWa}
          defaultPctEa={initEa}
          defaultPctEs={initEs}
          defaultPctAr={initAr}
          defaultCallsPerDay={initCalls}
          defaultMinutesPerReview={initMpr}
          defaultHourlyRate={initRate}
          onChange={handleChange}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            marginTop: 16,
          }}
        >
          <button
            onClick={handleCopy}
            style={{
              background: copied ? "#10b981" : "#1a1a2e",
              border: "1px solid #2a2a3e",
              borderRadius: 8,
              padding: "10px 20px",
              color: "#f9fafb",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.2s",
            }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>

          <a
            href="/"
            style={{
              fontSize: 11,
              color: "#6b7280",
              textDecoration: "none",
              letterSpacing: "0.02em",
            }}
          >
            Powered by Agora
          </a>
        </div>
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  return (
    <Suspense>
      <CalculatorInner />
    </Suspense>
  );
}
