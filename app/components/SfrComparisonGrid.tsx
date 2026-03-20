import type { SilentFailureRisk, SilentFailureRating, ProbeOverview } from "../types/cqs";
import SilentFailureRiskBadge from "./SilentFailureRiskBadge";
import styles from "./SfrComparisonGrid.module.css";

export interface VendorSfrEntry {
  vendor: string;
  risk: SilentFailureRisk;
  probeOverview?: ProbeOverview | null;
}

const RATING_RANK: Record<SilentFailureRating, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

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

function findBestVendor(vendors: VendorSfrEntry[]): string | null {
  if (vendors.length <= 1) return null;
  let best: VendorSfrEntry | null = null;
  let bestRank = Infinity;
  let tie = false;

  for (const v of vendors) {
    const rank = RATING_RANK[v.risk.rating];
    if (rank < bestRank) {
      best = v;
      bestRank = rank;
      tie = false;
    } else if (rank === bestRank) {
      tie = true;
    }
  }

  return tie ? null : best?.vendor ?? null;
}

export default function SfrComparisonGrid({ vendors }: { vendors: VendorSfrEntry[] }) {
  if (vendors.length === 0) return null;

  if (vendors.length === 1) {
    const { risk, probeOverview } = vendors[0];
    return <SilentFailureRiskBadge risk={risk} probeOverview={probeOverview} />;
  }

  const bestVendor = findBestVendor(vendors);

  return (
    <div className={styles.grid}>
      {vendors.map((entry) => {
        const isBest = entry.vendor === bestVendor;
        const conf = entry.risk.confidence_at_failure;
        const hasConf = conf && (conf.min !== null || conf.max !== null);

        return (
          <div
            key={entry.vendor}
            className={isBest ? styles.columnBest : styles.column}
          >
            <h3 className={styles.vendorName}>
              {entry.vendor}
              {isBest && <span className={styles.bestLabel}>Lowest Risk</span>}
            </h3>

            <div className={styles.badgeRow}>
              <span className={BADGE_CLASS[entry.risk.rating]}>
                {entry.risk.rating}
              </span>
              <span className={styles.direction}>
                {DIRECTION_LABEL[entry.risk.calibration_direction]}
              </span>
            </div>

            {hasConf && (
              <span className={styles.confRange}>
                conf at failure: {conf.min ?? "?"}&ndash;{conf.max ?? "?"}
              </span>
            )}

            {entry.risk.recommended_threshold_guard !== null && (
              <div className={styles.thresholdGuard}>
                ⚠ Set confidence_threshold: {entry.risk.recommended_threshold_guard}
              </div>
            )}

            {entry.probeOverview && (
              <div className={styles.probeSection}>
                {entry.probeOverview.probe_result === "disagree" ||
                entry.probeOverview.probe_result === "script_mismatch" ? (
                  <span className={styles.probeDetected}>probe detected mismatch</span>
                ) : entry.probeOverview.probe_verified ? (
                  <span className={styles.probeVerified}>probe verified</span>
                ) : null}
                {entry.probeOverview.adjusted_confidence !== null && (
                  <span className={styles.adjustedConf}>
                    adjusted confidence:{" "}
                    {entry.probeOverview.adjusted_confidence.toFixed(4)}
                  </span>
                )}
                {entry.probeOverview.probe_fds !== null && (
                  <span className={styles.probeFds}>
                    FDS: {entry.probeOverview.probe_fds.toFixed(4)}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
