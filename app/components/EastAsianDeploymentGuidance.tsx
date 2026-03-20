import type { EastAsianDeploymentGuidance } from "../types/cqs";
import styles from "./EastAsianDeploymentGuidance.module.css";

export default function EastAsianDeploymentGuidanceCard({
  guidance,
}: {
  guidance: EastAsianDeploymentGuidance | null;
}) {
  if (!guidance) return null;

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>
        {"🌏 East Asian Deployment Guidance"}
      </h2>

      <div className={styles.amberCallout}>
        Confidence threshold ≤ 0.80 required — ~18% catastrophic failure rate
        on Japanese and Korean audio.
      </div>

      {guidance.korean10Brittleness && (
        <div className={styles.redWarning}>
          ⚠ Threshold Boundary Risk: {guidance.korean10Brittleness.clipId} —
          confidence {guidance.korean10Brittleness.confidence}, WER{" "}
          {guidance.korean10Brittleness.wer}%. Setting threshold to 0.85 would
          miss it.
        </div>
      )}

      <h3 className={styles.checklistTitle}>Deployment Checklist</h3>
      <ul className={styles.checklist}>
        {guidance.checklist.map((item) => (
          <li key={item} className={styles.checkItem}>
            ✓ {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
