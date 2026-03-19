"use client";

import { useState, useRef, useCallback } from "react";
import type { CqsTier } from "../types/cqs";
import styles from "./CqsBadge.module.css";

const TIER_CONFIG: Record<
  CqsTier,
  { bg: string; color: string; icon: string; label: string; tooltip: string }
> = {
  high: {
    bg: "#D1FAE5",
    color: "#065F46",
    icon: "✓",
    label: "High",
    tooltip:
      "Calibrated confidence scores are reliable for this accent group. A score of 0.95 means ~0.95 accuracy — safe for routing, auto-approval, and downstream automation.",
  },
  moderate: {
    bg: "#FEF3C7",
    color: "#92400E",
    icon: "⚠",
    label: "Moderate",
    tooltip:
      "Confidence scores are informative on average, but degrade for the bottom 20–25% of speakers. Low-confidence clips may perform better or worse than expected. Recommend human review below your confidence threshold.",
  },
  low: {
    bg: "#FEE2E2",
    color: "#991B1B",
    icon: "✕",
    label: "Low",
    tooltip:
      "Confidence scores are not reliably predictive for this accent group. Do not use confidence as a signal for routing or automation decisions without per-speaker adaptation or a fallback layer.",
  },
  unknown: {
    bg: "#F3F4F6",
    color: "#6B7280",
    icon: "—",
    label: "—",
    tooltip:
      "Not enough data to compute confidence reliability for this accent group. Run a larger eval set or add more clips.",
  },
};

export default function CqsBadge({ tier }: { tier: CqsTier }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const config = TIER_CONFIG[tier];

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setShowTooltip(true), 200);
  }, []);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  }, []);

  return (
    <span
      className={styles.wrapper}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      role="status"
      aria-label={`Confidence reliability: ${config.label}`}
    >
      <span
        className={styles.badge}
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        <span className={styles.icon}>{config.icon}</span>
        {config.label}
      </span>
      {showTooltip && (
        <span className={styles.tooltip} role="tooltip">
          {config.tooltip}
        </span>
      )}
    </span>
  );
}
