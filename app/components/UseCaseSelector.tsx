"use client";

import { useId } from "react";
import { PRS_WEIGHT_PROFILES } from "@/lib/prs-profiles";
import type { UseCaseProfile } from "@/lib/prs-profiles";
import styles from "./UseCaseSelector.module.css";

export interface UseCaseSelectorProps {
  value: UseCaseProfile;
  onChange: (profile: UseCaseProfile) => void;
  className?: string;
}

const PROFILE_KEYS: UseCaseProfile[] = [
  "default",
  "high_stakes",
  "commodity",
  "multi_domain",
];

const BADGE_CONFIG: Partial<
  Record<UseCaseProfile, { text: string; className: string }>
> = {
  high_stakes: { text: "\u26A0 Trust-priority", className: styles.badgeAmber },
  commodity: {
    text: "\uD83D\uDCCA Volume-optimized",
    className: styles.badgeBlue,
  },
  multi_domain: {
    text: "\uD83C\uDF10 Global-ready",
    className: styles.badgeGreen,
  },
};

function formatWeights(profile: UseCaseProfile): string {
  const w = PRS_WEIGHT_PROFILES[profile];
  return `Trust ${Math.round(w.trust * 100)}% \u00B7 Drift ${Math.round(w.drift * 100)}% \u00B7 CII ${Math.round(w.cii * 100)}% \u00B7 OOD Detection ${Math.round(w.auroc * 100)}%`;
}

const INFO_TEXT =
  "Agora\u2019s PRS score measures four dimensions of production trustworthiness: " +
  "baseline calibration quality, drift stability, confidence integrity, and OOD " +
  "detection capability. Different deployment contexts care about these dimensions " +
  "differently. Selecting a context adjusts how much weight each dimension carries " +
  "in your score. The underlying eval data is identical \u2014 only the interpretation changes.";

export default function UseCaseSelector({
  value,
  onChange,
  className,
}: UseCaseSelectorProps) {
  const uid = useId();
  const groupId = `${uid}-uc-group`;

  return (
    <div
      className={`${styles.wrapper}${className ? ` ${className}` : ""}`}
      role="radiogroup"
      aria-labelledby={groupId}
    >
      <div className={styles.heading} id={groupId}>
        <span>Score tuned for your deployment context:</span>
        <button
          type="button"
          className={styles.infoTrigger}
          aria-label="What does this change?"
        >
          What does this change?
          <span className={styles.infoPopover} role="tooltip">
            {INFO_TEXT}
          </span>
        </button>
      </div>

      <div className={styles.radioGroup}>
        {PROFILE_KEYS.map((key) => {
          const profile = PRS_WEIGHT_PROFILES[key];
          const badge = BADGE_CONFIG[key];
          const selected = value === key;
          const optionId = `${uid}-uc-${key}`;

          return (
            <label
              key={key}
              className={`${styles.option}${selected ? ` ${styles.optionSelected}` : ""}`}
              htmlFor={optionId}
            >
              <input
                type="radio"
                id={optionId}
                name={groupId}
                value={key}
                checked={selected}
                onChange={() => onChange(key)}
                className={styles.hiddenRadio}
                aria-label={profile.label}
              />
              <span className={styles.radioIndicator} aria-hidden="true" />
              <span className={styles.optionContent}>
                <span className={styles.optionLabelRow}>
                  <span className={styles.optionLabel}>{profile.label}</span>
                  {badge && (
                    <span className={`${styles.badge} ${badge.className}`}>
                      {badge.text}
                    </span>
                  )}
                </span>
                {key !== "default" && (
                  <span className={styles.optionSublabel}>
                    {profile.description}
                  </span>
                )}
                <span className={styles.weights}>{formatWeights(key)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
