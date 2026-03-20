import type { SilentFailureRisk, SilentFailureRating, ProbeOverview } from "../types/cqs";
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
  probeOverview,
}: {
  risk: SilentFailureRisk;
  probeOverview?: ProbeOverview | null;
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

      {probeOverview && (
        <div className={styles.probeSection}>
          {probeOverview.probe_result === "disagree" || probeOverview.probe_result === "script_mismatch" ? (
            <span className={styles.probeDetected}>probe detected mismatch</span>
          ) : probeOverview.probe_verified ? (
            <span className={styles.probeVerified}>probe verified</span>
          ) : null}
          {probeOverview.adjusted_confidence !== null && (
            <span className={styles.adjustedConf}>
              adjusted confidence: {probeOverview.adjusted_confidence.toFixed(4)}
            </span>
          )}
          {probeOverview.probe_fds !== null && (
            <span className={styles.probeFds}>
              FDS: {probeOverview.probe_fds.toFixed(4)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
