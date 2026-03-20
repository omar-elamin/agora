import type { SilentFailureRisk, SilentFailureRating } from "../types/cqs";
import styles from "./SilentFailureRiskBadge.module.css";

const BADGE_CLASS: Record<SilentFailureRating, string> = {
  LOW: styles.badgeLow,
  MEDIUM: styles.badgeMedium,
  HIGH: styles.badgeHigh,
  CRITICAL: styles.badgeCritical,
};

const DIRECTION_LABEL: Record<string, string> = {
  overconfident_mild: "overconfident (mild)",
  overconfident_dangerous: "overconfident (dangerous)",
  underconfident: "underconfident",
  unavailable: "calibration unavailable",
};

export default function SilentFailureRiskBadge({
  risk,
}: {
  risk: SilentFailureRisk;
}) {
  const conf = risk.confidence_at_failure;
  const hasConf = conf && (conf.min !== null || conf.max !== null);

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Silent Failure Risk</h2>

      <div className={styles.badgeRow}>
        <span className={BADGE_CLASS[risk.rating]}>{risk.rating}</span>
        <span className={styles.direction}>
          {DIRECTION_LABEL[risk.calibration_direction]}
        </span>
        {hasConf && (
          <span className={styles.confRange}>
            conf at failure: {conf.min ?? "?"}&ndash;{conf.max ?? "?"}
          </span>
        )}
      </div>

      {risk.recommended_threshold_guard !== null && (
        <div className={styles.thresholdGuard}>
          ⚠ Set confidence_threshold: {risk.recommended_threshold_guard}
        </div>
      )}

      <p className={styles.rationale}>{risk.rationale}</p>
    </div>
  );
}
