import CqsBadge from "./CqsBadge";
import styles from "./CqsContrastCard.module.css";

export default function CqsContrastCard() {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>CQS Contrast — Why Sample Size Matters</h3>

      <div className={styles.panels}>
        {/* Hindi — High tier */}
        <div className={styles.panelHigh}>
          <div className={styles.panelHeader}>
            <span className={styles.iconPass}>✓</span>
            <span className={styles.panelAccent}>Hindi</span>
            <CqsBadge tier="high" />
          </div>
          <div className={styles.stat}>
            Q1 variance: <span className={styles.mono}>0.0003</span>
          </div>
          <div className={styles.stat}>Confidence tracks accuracy</div>
        </div>

        {/* Spanish n=50 — Low tier */}
        <div className={styles.panelLow}>
          <div className={styles.panelHeader}>
            <span className={styles.iconFail}>✕</span>
            <span className={styles.panelAccent}>Spanish (n=50)</span>
            <CqsBadge tier="low" />
          </div>
          <div className={styles.stat}>
            Q1 variance: <span className={styles.mono}>0.091</span>
          </div>
          <div className={styles.stat}>Confidence fails as routing signal</div>
        </div>
      </div>

      <div className={styles.narrative}>
        Same model. Same confidence range. Completely different reliability.
        Agora catches this.
      </div>
    </div>
  );
}
