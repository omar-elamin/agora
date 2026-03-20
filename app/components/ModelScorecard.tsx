"use client";

import { useState } from "react";
import type { CqsTier, ModelScorecardData } from "../types/cqs";
import CqsBadge from "./CqsBadge";
import styles from "./ModelScorecard.module.css";

const DOT_COLORS: Record<CqsTier, string> = {
  high: "#34D399",
  moderate: "#FBBF24",
  low: "#F87171",
  unknown: "#9CA3AF",
};

function aggregateLabel(groups: { accent: string; cqs: CqsTier }[]): {
  text: string;
  color: string;
} {
  const total = groups.length;
  const highCount = groups.filter((g) => g.cqs === "high").length;
  const hasLow = groups.some((g) => g.cqs === "low");

  if (highCount === total) {
    return { text: "High — all accent groups", color: "#34D399" };
  }
  if (hasLow) {
    return {
      text: "Caution — 1+ accent group at Low reliability",
      color: "#F87171",
    };
  }
  return {
    text: `High for ${highCount} of ${total} accent groups`,
    color: "#E5E7EB",
  };
}

export default function ModelScorecard({
  data,
}: {
  data: ModelScorecardData;
}) {
  const [expanded, setExpanded] = useState(false);
  const agg = aggregateLabel(data.accentGroups);

  const rows: [string, React.ReactNode][] = [
    ["Model", data.model],
    ["Eval Date", (() => { try { return new Date(data.evalDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); } catch { return data.evalDate; } })()],
    ["Total Clips", data.totalClips.toLocaleString()],
    ["Overall WER", `${data.overallWer.toFixed(1)}%`],
    [
      "Expected Calibration Error",
      `${data.ece.toFixed(3)} (post-calibration avg)`,
    ],
  ];

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Model Scorecard</h3>

      <dl className={styles.grid}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}

        {/* Confidence Reliability row */}
        <div className={styles.row}>
          <dt className={styles.label}>Confidence Reliability</dt>
          <dd className={styles.value}>
            <button
              className={styles.expandBtn}
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
            >
              <span style={{ color: agg.color }}>{agg.text}</span>
              <span className={styles.dots}>
                {data.accentGroups.map((g) => (
                  <span key={g.accent} className={styles.dotWrap}>
                    <span
                      className={styles.dot}
                      style={{ backgroundColor: DOT_COLORS[g.cqs] }}
                      title={`${g.accent}: ${g.cqs}`}
                    />
                  </span>
                ))}
              </span>
              <span
                className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
              >
                ›
              </span>
            </button>

            {expanded && (
              <div className={styles.detail}>
                {data.accentGroups.map((g) => (
                  <div key={g.accent} className={styles.detailRow}>
                    <span className={styles.detailAccent}>{g.accent}</span>
                    <CqsBadge tier={g.cqs} />
                  </div>
                ))}
              </div>
            )}
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>Threshold</dt>
          <dd className={styles.value}>T = {data.threshold.toFixed(1)}</dd>
        </div>
      </dl>
    </div>
  );
}
