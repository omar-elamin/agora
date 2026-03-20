"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { computeSilentFailureRisk } from "@/lib/silent-failure-risk";
import type { SilentFailureRisk } from "@/app/types/cqs";
import SilentFailureRiskBadge from "@/app/components/SilentFailureRiskBadge";
import styles from "./page.module.css";

interface VendorData {
  name: string;
  model: string;
  risk: SilentFailureRisk;
}

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
): Promise<SilentFailureRisk | null> {
  try {
    const res = await fetch(`/api/v1/eval/${evalId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const match = data.results?.find(
      (r: { vendor: string }) =>
        r.vendor.toLowerCase() === vendorName.toLowerCase()
    );
    return match?.silent_failure_risk ?? null;
  } catch {
    return null;
  }
}

function ComparePageInner() {
  const searchParams = useSearchParams();
  const [vendors, setVendors] = useState<VendorData[]>(VENDOR_DEFAULTS);

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
          const risk = await fetchEvalRisk(evalId, vendorName);
          return { vendorName, risk };
        })
      );

      if (cancelled) return;

      setVendors((prev) =>
        prev.map((v) => {
          const update = updates.find((u) => u.vendorName === v.name);
          if (update?.risk) return { ...v, risk: update.risk };
          return v;
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Vendor Comparison</h1>
        <p className={styles.subtitle}>
          Silent failure risk across ASR vendors
        </p>
      </header>

      <div className={styles.grid}>
        {vendors.map((v) => (
          <div key={v.name} className={styles.vendorCard}>
            <h2 className={styles.vendorName}>{v.name}</h2>
            <p className={styles.modelName}>{v.model}</p>
            <SilentFailureRiskBadge risk={v.risk} />
          </div>
        ))}
      </div>

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
