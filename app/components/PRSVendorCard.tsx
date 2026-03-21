"use client";

import { useMemo, useId, useState } from "react";
import { PRS_WEIGHT_PROFILES } from "@/lib/prs-profiles";
import type { UseCaseProfile } from "@/lib/prs-profiles";
import UseCaseSelector from "./UseCaseSelector";
import styles from "./PRSVendorCard.module.css";

/* ── Types ───────────────────────────────────────────── */

export interface PRSComponentScores {
  trust_score_ID: number | null;
  mean_ECE_shift: number | null;
  cii: number | null;
  ood_detection_auroc: number | null;
}

export interface PRSVendorData {
  vendor_id: string;
  vendor_name: string;
  components: PRSComponentScores;
}

export interface PRSVendorCardProps {
  vendor: PRSVendorData;
  initialProfile?: UseCaseProfile;
  compact?: boolean;
  /** Controlled profile (for comparison view). Overrides internal state. */
  profile?: UseCaseProfile;
  onProfileChange?: (profile: UseCaseProfile) => void;
}

/* ── Constants ───────────────────────────────────────── */

const COMPONENT_DEFS = [
  {
    key: "trust" as const,
    label: "ID Calibration Quality",
    shortLabel: "ID Cal",
    fillClass: "barFillIndigo",
    tooltip:
      "How accurate this vendor\u2019s confidence scores are on familiar, in-distribution data. A score of 80% means the model\u2019s stated confidence is well-calibrated \u2014 when it says 80% confidence, it\u2019s right about 80% of the time. Low scores here mean the model is systematically over- or under-confident even on data it was trained for.",
  },
  {
    key: "drift" as const,
    label: "Drift Stability",
    shortLabel: "Drift",
    fillClass: "barFillTeal",
    tooltip:
      "How much this vendor\u2019s calibration degrades when the input distribution shifts away from training data. High scores mean the model stays reliably calibrated even when facing unfamiliar inputs \u2014 a critical requirement for any production deployment where real-world data differs from benchmarks.",
  },
  {
    key: "cii" as const,
    label: "Confidence Integrity",
    shortLabel: "Conf Int",
    fillClass: "barFillViolet",
    tooltip:
      "Whether this vendor inflates its confidence scores when facing out-of-distribution inputs. High scores mean the model stays calibrated (or becomes appropriately less confident) under shift. Low scores mean the model becomes confidently wrong \u2014 the most dangerous failure mode in production, because monitoring systems relying on confidence thresholds will miss the degradation.",
  },
  {
    key: "ood" as const,
    label: "OOD Detection",
    shortLabel: "OOD Det",
    fillClass: "barFillOrange",
    tooltip:
      "How reliably this vendor can identify when an input is out-of-distribution \u2014 outside what it was trained on. High scores enable intelligent routing: flagging unusual inputs for human review rather than returning a low-confidence prediction. Critical for deployments with variable input quality or scope.",
  },
] as const;

type CompKey = (typeof COMPONENT_DEFS)[number]["key"];

/* ── Computations ────────────────────────────────────── */

function computeComponentValues(c: PRSComponentScores): Record<CompKey, number | null> {
  const trust = c.trust_score_ID;
  const drift =
    c.mean_ECE_shift !== null ? 1 - Math.min(c.mean_ECE_shift / 0.2, 1.0) : null;
  const cii =
    c.cii !== null
      ? c.cii <= 1.0
        ? 1.0
        : 1 - Math.min(Math.max(c.cii - 1.0, 0) / 1.0, 1.0)
      : null;
  const ood = c.ood_detection_auroc;
  return { trust, drift, cii, ood };
}

function computePRS(
  vals: Record<CompKey, number | null>,
  rawComponents: PRSComponentScores,
  profileKey: UseCaseProfile,
): { score: number | null; available: CompKey[]; missing: string[] } {
  const profileWeights = PRS_WEIGHT_PROFILES[profileKey];
  const weightMap = {
    trust: profileWeights.trust,
    drift: profileWeights.drift,
    cii: profileWeights.cii,
    ood: profileWeights.auroc,
  };
  const entries: { key: CompKey; val: number; w: number }[] = [];
  const missing: string[] = [];

  for (const def of COMPONENT_DEFS) {
    const v = vals[def.key];
    if (v !== null) {
      entries.push({ key: def.key, val: v, w: weightMap[def.key] });
    } else {
      missing.push(def.label);
    }
  }

  if (entries.length < 2) {
    return { score: null, available: [], missing: missing };
  }

  const totalWeight = entries.reduce((s, e) => s + e.w, 0);
  let prs = 0;
  for (const e of entries) {
    prs += e.val * (e.w / totalWeight);
  }
  prs = Math.round(prs * 100);

  // Trust floor
  if (rawComponents.trust_score_ID !== null && rawComponents.trust_score_ID < 0.6) {
    prs = Math.min(prs, 70);
  }

  return {
    score: prs,
    available: entries.map((e) => e.key),
    missing,
  };
}

function getLabelConfig(score: number): { text: string; className: string } {
  if (score >= 85) return { text: "Production-ready", className: styles.labelGreen };
  if (score >= 70)
    return { text: "Solid for stable deployments", className: styles.labelBlue };
  if (score >= 55)
    return { text: "Requires monitoring infrastructure", className: styles.labelYellow };
  return { text: "Not recommended for production", className: styles.labelRed };
}

function isSilentDriftRisk(c: PRSComponentScores): boolean {
  return (
    c.cii !== null &&
    c.mean_ECE_shift !== null &&
    c.trust_score_ID !== null &&
    c.cii > 1.2 &&
    c.mean_ECE_shift > 0.1 &&
    c.trust_score_ID > 0.75
  );
}

function barFillClass(
  pct: number,
  defaultClass: string,
): string {
  if (pct < 30) return styles.barFillRed;
  if (pct < 55) return styles.barFillAmber;
  return styles[defaultClass] ?? "";
}

/* ── Tooltip helper ──────────────────────────────────── */

function Tip({ id, text }: { id: string; text: string }) {
  return (
    <span
      className={styles.tipTrigger}
      tabIndex={0}
      aria-describedby={id}
    >
      ?
      <span className={styles.tipText} role="tooltip" id={id}>
        {text}
      </span>
    </span>
  );
}

/* ── Main Component ──────────────────────────────────── */

export default function PRSVendorCard({
  vendor,
  initialProfile = "default",
  compact = false,
  profile: controlledProfile,
  onProfileChange,
}: PRSVendorCardProps) {
  const uid = useId();
  const [internalProfile, setInternalProfile] = useState<UseCaseProfile>(initialProfile);

  // Support controlled + uncontrolled usage
  const activeProfile = controlledProfile ?? internalProfile;
  const handleProfileChange = (p: UseCaseProfile) => {
    if (onProfileChange) onProfileChange(p);
    else setInternalProfile(p);
  };

  const sdr = isSilentDriftRisk(vendor.components);
  const vals = useMemo(() => computeComponentValues(vendor.components), [vendor.components]);

  const { score, missing } = useMemo(
    () => computePRS(vals, vendor.components, activeProfile),
    [vals, vendor.components, activeProfile],
  );

  // Default score for delta display
  const defaultScore = useMemo(() => {
    if (activeProfile === "default") return null;
    return computePRS(vals, vendor.components, "default").score;
  }, [vals, vendor.components, activeProfile]);

  const trustFloorActive =
    vendor.components.trust_score_ID !== null &&
    vendor.components.trust_score_ID < 0.6;
  const label = score !== null ? getLabelConfig(score) : null;

  /* ── Score delta ─────────────────────────────── */
  let deltaEl: React.ReactNode = null;
  if (score !== null && activeProfile !== "default" && defaultScore !== null) {
    const diff = score - defaultScore;
    if (diff > 0) {
      deltaEl = (
        <span className={styles.scoreDelta} data-direction="up">
          {"\u2191"} from {defaultScore} (default)
        </span>
      );
    } else if (diff < 0) {
      deltaEl = (
        <span className={styles.scoreDelta} data-direction="down">
          {"\u2193"} from {defaultScore} (default)
        </span>
      );
    } else {
      deltaEl = (
        <span className={styles.scoreDelta} data-direction="same">
          = default
        </span>
      );
    }
  } else if (score !== null && activeProfile === "default") {
    deltaEl = (
      <span className={styles.scoreDelta} data-direction="same">
        = default
      </span>
    );
  }

  /* ── Evaluation pending state ────────────────── */
  if (score === null) {
    return (
      <div className={`${styles.card}${compact ? ` ${styles.cardCompact}` : ""}`}>
        <div className={`${styles.header}${compact ? ` ${styles.headerCompact}` : ""}`}>
          <h3 className={styles.vendorName}>{vendor.vendor_name}</h3>
        </div>
        <div className={styles.pendingBlock}>
          <p className={styles.pendingTitle}>Production Readiness Score</p>
          <p className={styles.pendingText}>Evaluation pending</p>
          <p className={styles.pendingSub}>
            This vendor has not yet been evaluated by Agora.
          </p>
          <button className={styles.pendingCta} type="button">
            Request evaluation &rarr;
          </button>
        </div>
      </div>
    );
  }

  /* ── Normal card ─────────────────────────────── */
  return (
    <div className={`${styles.card}${compact ? ` ${styles.cardCompact}` : ""}`}>
      {/* Header */}
      <div className={`${styles.header}${compact ? ` ${styles.headerCompact}` : ""}`}>
        <h3 className={styles.vendorName}>{vendor.vendor_name}</h3>
        {sdr && (
          <span
            className={styles.sdrBadge}
            role="alert"
            aria-label="Warning: Silent Drift Risk detected"
            tabIndex={0}
          >
            {compact ? "SDR \u26A0" : "\u26A0 Silent Drift Risk"}
            <span className={styles.sdrTooltip} role="tooltip" id={`${uid}-sdr`}>
              <span className={styles.sdrTooltipTitle}>
                Silent Drift Risk detected
              </span>
              <br />
              This vendor scores well on ID calibration but shows dangerous behavior
              under distribution shift: confidence scores inflate while calibration
              degrades. In production, this creates a silent failure mode &mdash;
              monitoring systems that rely on confidence thresholds will not catch the
              degradation. Requires explicit OOD monitoring infrastructure before
              production use.
            </span>
          </span>
        )}
      </div>

      {/* Score block */}
      <div
        className={`${styles.scoreBlock}${compact ? ` ${styles.scoreBlockCompact}` : ""}`}
      >
        <p className={styles.scoreHeading}>Production Readiness Score</p>
        <span
          aria-label={`Production Readiness Score: ${score} out of 100`}
        >
          <span
            className={`${styles.scoreNumber} ${styles.scoreAnimated}${compact ? ` ${styles.scoreNumberCompact}` : ""}`}
          >
            {score}
          </span>
          <span
            className={`${styles.scoreDenom}${compact ? ` ${styles.scoreDenomCompact}` : ""}`}
          >
            {" "}
            / 100
          </span>
        </span>

        {/* Score delta */}
        {!compact && deltaEl}

        {/* Label badge */}
        {label && (
          <div>
            <span
              className={`${styles.labelBadge} ${label.className}`}
              aria-label={`Rating: ${label.text}`}
            >
              {label.text}
            </span>
          </div>
        )}

        {/* Trust floor */}
        {trustFloorActive && (
          <div
            className={`${styles.trustFloor}${compact ? ` ${styles.trustFloorCompact}` : ""}`}
          >
            <span className={styles.trustFloorIcon}>{"\u26A0"}</span>
            <span
              className={`${styles.trustFloorText}${compact ? ` ${styles.trustFloorCompactText}` : ""}`}
            >
              {compact ? (
                "\u26A0 Floor"
              ) : (
                <>
                  <span className={styles.trustFloorTitle}>
                    Score capped at 70
                  </span>
                  <span className={styles.trustFloorSub}>
                    Baseline calibration is below the minimum threshold for
                    production trust.
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Missing components note */}
        {missing.length > 0 && (
          <p className={styles.missingNote}>
            Score computed from {4 - missing.length} of 4 components &mdash;{" "}
            {missing.join(", ")} data unavailable
          </p>
        )}
      </div>

      {/* Use-case selector (full view only) */}
      {!compact && (
        <UseCaseSelector
          value={activeProfile}
          onChange={handleProfileChange}
        />
      )}

      {/* Divider */}
      <hr className={`${styles.divider}${compact ? ` ${styles.dividerCompact}` : ""}`} />

      {/* Component bars */}
      {!compact && (
        <p className={styles.barsHeading}>Component Breakdown</p>
      )}
      <div className={`${styles.barsList}${compact ? ` ${styles.barsListCompact}` : ""}`}>
        {COMPONENT_DEFS.map((def) => {
          const raw = vals[def.key];
          const pct = raw !== null ? Math.round(raw * 100) : null;
          const tipId = `${uid}-tip-${def.key}`;

          return (
            <div className={styles.barRow} key={def.key}>
              <span
                className={`${styles.barLabel}${compact ? ` ${styles.barLabelCompact}` : ""}`}
              >
                {compact ? def.shortLabel : def.label}
              </span>

              <div
                className={styles.barTrack}
                role="progressbar"
                aria-valuenow={pct ?? undefined}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={
                  pct !== null
                    ? `${def.label}: ${pct}%`
                    : `${def.label}: data unavailable`
                }
              >
                {pct !== null && (
                  <div
                    className={`${styles.barFill} ${barFillClass(pct, def.fillClass)}`}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>

              <span
                className={`${styles.barValue}${compact ? ` ${styles.barValueCompact}` : ""}${pct === null ? ` ${styles.barValueNa}` : ""}`}
              >
                {pct !== null ? `${pct}%` : "N/A"}
              </span>

              {!compact && <Tip id={tipId} text={def.tooltip} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
