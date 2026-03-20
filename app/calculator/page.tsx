"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useRef, useState } from "react";
import ReviewCostCalculator, {
  type ReviewCostValues,
} from "../components/ReviewCostCalculator";

const PRESETS = {
  small: {
    label: "Small team",
    wa: 15, ea: 0, es: 0, ar: 0,
    calls: 1000, mpr: 5, rate: 25,
  },
  midmarket: {
    label: "Mid-market",
    wa: 22, ea: 3, es: 2, ar: 2,
    calls: 10000, mpr: 8, rate: 35,
  },
  enterprise: {
    label: "Enterprise",
    wa: 30, ea: 5, es: 3, ar: 3,
    calls: 100000, mpr: 12, rate: 50,
  },
} as const;

type PresetKey = keyof typeof PRESETS;

function CalculatorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const initWa = Number(searchParams.get("wa")) || 20;
  const initEa = Number(searchParams.get("ea")) || 5;
  const initEs = Number(searchParams.get("es")) || 5;
  const initAr = Number(searchParams.get("ar")) || 5;
  const initCalls = Number(searchParams.get("calls")) || 1000;
  const initMpr = Number(searchParams.get("mpr")) || 15;
  const initRate = Number(searchParams.get("rate")) || 25;
  const isEmbed = searchParams.get("embed") === "true";
  const activePreset = searchParams.get("preset") as PresetKey | null;

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
      if (isEmbed) params.set("embed", "true");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, isEmbed],
  );

  const applyPreset = useCallback(
    (key: PresetKey) => {
      const p = PRESETS[key];
      const params = new URLSearchParams();
      params.set("preset", key);
      params.set("wa", String(p.wa));
      params.set("ea", String(p.ea));
      params.set("es", String(p.es));
      params.set("ar", String(p.ar));
      params.set("calls", String(p.calls));
      params.set("mpr", String(p.mpr));
      params.set("rate", String(p.rate));
      if (isEmbed) params.set("embed", "true");
      router.replace(`?${params.toString()}`, { scroll: false });
      setResetKey((k) => k + 1);
    },
    [router, isEmbed],
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {isEmbed && <style>{`nav { display: none !important; }`}</style>}
    <div
      style={{
        ...(isEmbed ? {} : { minHeight: "100vh" }),
        background: isEmbed ? "transparent" : "#0a0a1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: isEmbed ? "16px" : "40px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 800 }}>
        {!isEmbed && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                style={{
                  background: activePreset === key ? "#1a1a3e" : "transparent",
                  border: `1px solid ${activePreset === key ? "#9b9be0" : "#4a4a6e"}`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  color: "#9b9be0",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {PRESETS[key].label}
              </button>
            ))}
          </div>
        )}
        <ReviewCostCalculator
          key={resetKey}
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
          {!isEmbed && (
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
          )}

          {!isEmbed && (
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
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default function CalculatorPage() {
  return (
    <Suspense>
      <CalculatorInner />
    </Suspense>
  );
}
