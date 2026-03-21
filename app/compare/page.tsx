"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useMemo, useCallback } from "react";
import { computeSilentFailureRisk } from "@/lib/silent-failure-risk";
import type { SilentFailureRisk } from "@/app/types/cqs";
import type { UseCaseProfile } from "@/lib/prs-profiles";
import SilentFailureRiskBadge from "@/app/components/SilentFailureRiskBadge";
import SfrComparisonGrid from "@/app/components/SfrComparisonGrid";
import UseCaseSelector from "@/app/components/UseCaseSelector";
import type { VendorSfrEntry } from "@/app/components/SfrComparisonGrid";
import styles from "./page.module.css";

interface VendorData {
  name: string;
  model: string;
  risk: SilentFailureRisk;
  wer?: number | null;
  ece?: number | null;
}

type SortKey = "risk" | "wer" | "ece";

const RISK_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const VENDOR_DEFAULTS: VendorData[] = [
  {
    name: "AssemblyAI",
    model: "Universal-2",
    risk: computeSilentFailureRisk({
      vendor: "assemblyai",
      wer: null,
      routing_failure: true,
      routing_failure_reason: "language detection misfire",
    }),
  },
  {
    name: "Deepgram",
    model: "Nova-3",
    risk: computeSilentFailureRisk({
      vendor: "deepgram",
      wer: null,
      routing_failure: false,
      routing_failure_reason: null,
    }),
  },
  {
    name: "Whisper",
    model: "large-v3",
    risk: computeSilentFailureRisk({
      vendor: "whisper-large-v3",
      wer: null,
      routing_failure: false,
      routing_failure_reason: null,
    }),
  },
];

const VENDOR_PARAM_MAP: Record<string, string> = {
  assemblyai_evalId: "AssemblyAI",
  deepgram_evalId: "Deepgram",
  whisper_evalId: "Whisper",
};

async function fetchEvalRisk(
  evalId: string,
  vendorName: string
): Promise<{ risk: SilentFailureRisk | null; wer?: number | null; ece?: number | null }> {
  try {
    const res = await fetch(`/api/v1/eval/${evalId}`);
    if (!res.ok) return { risk: null };
    const data = await res.json();
    const match = data.results?.find(
      (r: { vendor: string }) =>
        r.vendor.toLowerCase() === vendorName.toLowerCase()
    );
    return {
      risk: match?.silent_failure_risk ?? null,
      wer: match?.wer ?? null,
      ece: match?.ece ?? null,
    };
  } catch {
    return { risk: null };
  }
}

function ComparePageInner() {
  const searchParams = useSearchParams();
  const [vendors, setVendors] = useState<VendorData[]>(VENDOR_DEFAULTS);
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [profile, setProfile] = useState<UseCaseProfile>("default");
  const [toastVisible, setToastVisible] = useState(false);

  const handleProfileChange = useCallback((p: UseCaseProfile) => {
    setProfile(p);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1500);
  }, []);

  useEffect(() => {
    const evalIds: Record<string, string> = {};
    for (const [param, vendorName] of Object.entries(VENDOR_PARAM_MAP)) {
      const val = searchParams.get(param);
      if (val) evalIds[vendorName] = val;
    }

    if (Object.keys(evalIds).length === 0) return;

    let cancelled = false;

    (async () => {
      const updates = await Promise.all(
        Object.entries(evalIds).map(async ([vendorName, evalId]) => {
          const result = await fetchEvalRisk(evalId, vendorName);
          return { vendorName, ...result };
        })
      );

      if (cancelled) return;

      setVendors((prev) =>
        prev.map((v) => {
          const update = updates.find((u) => u.vendorName === v.name);
          if (!update) return v;
          return {
            ...v,
            ...(update.risk ? { risk: update.risk } : {}),
            ...(update.wer !== undefined ? { wer: update.wer } : {}),
            ...(update.ece !== undefined ? { ece: update.ece } : {}),
          };
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const sortedVendors = useMemo(() => {
    return [...vendors].sort((a, b) => {
      if (sortKey === "risk") {
        const aOrder = RISK_ORDER[a.risk.rating] ?? 99;
        const bOrder = RISK_ORDER[b.risk.rating] ?? 99;
        return aOrder - bOrder;
      }
      if (sortKey === "wer") {
        const aVal = a.wer ?? Infinity;
        const bVal = b.wer ?? Infinity;
        return aVal - bVal;
      }
      if (sortKey === "ece") {
        const aVal = a.ece ?? Infinity;
        const bVal = b.ece ?? Infinity;
        return aVal - bVal;
      }
      return 0;
    });
  }, [vendors, sortKey]);

  const sfrEntries: VendorSfrEntry[] = useMemo(
    () =>
      sortedVendors.map((v) => ({
        vendor: v.name,
        risk: v.risk,
        probeOverview: null,
      })),
    [sortedVendors]
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Vendor Comparison</h1>
        <p className={styles.subtitle}>
          Silent failure risk across ASR vendors
        </p>
      </header>

      {/* Global PRS profile selector */}
      <div className={styles.profileSelector}>
        <UseCaseSelector
          value={profile}
          onChange={handleProfileChange}
        />
      </div>

      {/* Toast notification */}
      <div
        className={`${styles.toast} ${toastVisible ? styles.toastVisible : ""}`}
        role="status"
        aria-live="polite"
      >
        Rankings updated
      </div>

      <div className={styles.controls}>
        <span className={styles.controlLabel}>Sort by:</span>
        <button
          className={`${styles.sortButton} ${sortKey === "risk" ? styles.sortButtonActive : ""}`}
          onClick={() => setSortKey("risk")}
        >
          Risk Level
        </button>
        <button
          className={`${styles.sortButton} ${sortKey === "wer" ? styles.sortButtonActive : ""}`}
          onClick={() => setSortKey("wer")}
        >
          WER
        </button>
        <button
          className={`${styles.sortButton} ${sortKey === "ece" ? styles.sortButtonActive : ""}`}
          onClick={() => setSortKey("ece")}
        >
          ECE
        </button>
      </div>

      <div className={styles.grid}>
        {sortedVendors.map((v) => (
          <div key={v.name} className={styles.vendorCard}>
            <h2 className={styles.vendorName}>{v.name}</h2>
            <p className={styles.modelName}>{v.model}</p>
            <SilentFailureRiskBadge risk={v.risk} />
            <div className={styles.metrics}>
              <span className={styles.metric}>
                WER: {v.wer != null ? `${(v.wer * 100).toFixed(1)}%` : "\u2014"}
              </span>
              <span className={styles.metric}>
                ECE: {v.ece != null ? `${(v.ece * 100).toFixed(1)}%` : "\u2014"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <section className={styles.sfrSection}>
        <h2 className={styles.h2}>Silent Failure Risk Comparison</h2>
        <SfrComparisonGrid vendors={sfrEntries} />
      </section>

      <div className={styles.header}>
        <a href="/" className={styles.backLink}>
          &larr; Home
        </a>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <ComparePageInner />
    </Suspense>
  );
}
