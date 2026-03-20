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
                confidence scores are not reliably predictive of accuracy. Q1
                clips range from 0% to 88% accuracy within a narrow confidence
                band. Hard clips like{" "}
                <span className={styles.mono}>spanish3</span> and{" "}
                <span className={styles.mono}>spanish21</span> show complete
                transcription failures at moderate confidence. Do not use
                confidence for routing — implement human review for all clips in
                this accent group.
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
