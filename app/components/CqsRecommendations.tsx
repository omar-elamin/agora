"use client";

import type { AccentGroupData } from "../types/cqs";
import styles from "./CqsRecommendations.module.css";

export default function CqsRecommendations({ data }: { data: AccentGroupData[] }) {
  const actionable = data.filter((g) => g.cqs === "moderate" || g.cqs === "low");

  if (actionable.length === 0) return null;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Recommendations</h3>
      <div className={styles.list}>
        {actionable.map((g) => (
          <div key={g.accent} className={g.cqs === "low" ? styles.low : styles.moderate}>
            {g.cqs === "moderate" ? (
              <>
                For <span className={styles.accent}>{g.accent}</span> callers,
                calibrated confidence is less reliable at the low end. We recommend
                flagging clips with calibrated confidence{" "}
                <span className={styles.mono}>&lt; 0.93</span> for human review.
              </>
            ) : (
              <>
                For <span className={styles.accent}>{g.accent}</span> callers,
                confidence scores are not reliably predictive. Do not use confidence
                for routing or automation — implement a fallback layer or per-speaker
                adaptation.
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
