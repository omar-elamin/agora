"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ReviewCostCalculator.module.css";

const FALSE_POSITIVE_RATES: Record<string, number> = {
  wa: 0.667,
  ea: 0.17,
  es: 0.067,
  ar: 0.067,
};

const ACCENT_LABELS: Record<string, string> = {
  wa: "West African",
  ea: "East Asian",
  es: "Spanish",
  ar: "Arabic",
};

const WORKING_DAYS_PER_MONTH = 22;

export interface ReviewCostValues {
  pctWa: number;
  pctEa: number;
  pctEs: number;
  pctAr: number;
  callsPerDay: number;
  minutesPerReview: number;
  hourlyRate: number;
}

interface ReviewCostCalculatorProps {
  defaultPctWa?: number;
  defaultPctEa?: number;
  defaultPctEs?: number;
  defaultPctAr?: number;
  defaultCallsPerDay?: number;
  defaultMinutesPerReview?: number;
  defaultHourlyRate?: number;
  onChange?: (values: ReviewCostValues) => void;
}

const ACCENT_KEYS = ["wa", "ea", "es", "ar"] as const;

export default function ReviewCostCalculator({
  defaultPctWa = 20,
  defaultPctEa = 5,
  defaultPctEs = 5,
  defaultPctAr = 5,
  defaultCallsPerDay = 1000,
  defaultMinutesPerReview = 15,
  defaultHourlyRate = 25,
  onChange,
}: ReviewCostCalculatorProps = {}) {
  const [accents, setAccents] = useState<Record<string, number>>({
    wa: defaultPctWa,
    ea: defaultPctEa,
    es: defaultPctEs,
    ar: defaultPctAr,
  });
  const [callsPerDay, setCallsPerDay] = useState(defaultCallsPerDay);
  const [minutesPerReview, setMinutesPerReview] = useState(defaultMinutesPerReview);
  const [hourlyRate, setHourlyRate] = useState(defaultHourlyRate);

  const stableOnChange = useCallback(
    (v: ReviewCostValues) => {
      onChange?.(v);
    },
    [onChange],
  );

  useEffect(() => {
    stableOnChange({
      pctWa: accents.wa,
      pctEa: accents.ea,
      pctEs: accents.es,
      pctAr: accents.ar,
      callsPerDay,
      minutesPerReview,
      hourlyRate,
    });
  }, [accents, callsPerDay, minutesPerReview, hourlyRate, stableOnChange]);

  const totalAccentPct = ACCENT_KEYS.reduce((sum, k) => sum + accents[k], 0);

  const setAccentPct = (key: string, raw: number) => {
    const othersSum = ACCENT_KEYS.reduce(
      (sum, k) => (k === key ? sum : sum + accents[k]),
      0,
    );
    const capped = Math.min(raw, 100 - othersSum);
    setAccents((prev) => ({ ...prev, [key]: Math.max(0, capped) }));
  };

  // Blended false-positive rate across all accent groups
  const blendedRate =
    ACCENT_KEYS.reduce(
      (sum, k) => sum + (accents[k] / 100) * FALSE_POSITIVE_RATES[k],
      0,
    );

  const aaiQueue = callsPerDay * blendedRate;
  const dgQueue = 0;
  const aaiHours = (aaiQueue * minutesPerReview) / 60;
  const dgHours = 0;
  const hoursSaved = aaiHours - dgHours;
  const costSavedDay = hoursSaved * hourlyRate;
  const costSavedMonth = costSavedDay * WORKING_DAYS_PER_MONTH;

  const remainingPct = 100 - totalAccentPct;

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Review Cost Calculator</h2>

      <div className={styles.accentSection}>
        <span className={styles.accentSectionLabel}>
          Accent mix ({totalAccentPct}% accented, {remainingPct}% standard)
        </span>

        {ACCENT_KEYS.map((key) => (
          <div key={key} className={styles.inputGroup}>
            <label className={styles.label}>% {ACCENT_LABELS[key]} speakers</label>
            <div className={styles.sliderRow}>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={100}
                step={1}
                value={accents[key]}
                onChange={(e) => setAccentPct(key, Number(e.target.value))}
              />
              <span className={styles.sliderValue}>{accents[key]}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.inputs}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Calls per day</label>
          <input
            type="number"
            className={styles.numberInput}
            min={1}
            value={callsPerDay}
            onChange={(e) => setCallsPerDay(Math.max(1, Number(e.target.value)))}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Minutes per review</label>
          <input
            type="number"
            className={styles.numberInput}
            min={1}
            value={minutesPerReview}
            onChange={(e) => setMinutesPerReview(Math.max(1, Number(e.target.value)))}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Staff hourly rate $</label>
          <input
            type="number"
            className={styles.numberInput}
            min={1}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(Math.max(1, Number(e.target.value)))}
          />
        </div>
      </div>

      <div className={styles.vendorCards}>
        <div className={styles.vendorCardAai}>
          <h3 className={styles.vendorNameAai}>AssemblyAI</h3>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Review queue / day</span>
            <span className={styles.metricValue}>{aaiQueue.toFixed(1)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Staff-hours / day</span>
            <span className={styles.metricValue}>{aaiHours.toFixed(1)}</span>
          </div>
        </div>

        <div className={styles.vendorCardDg}>
          <h3 className={styles.vendorNameDg}>Deepgram</h3>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Review queue / day</span>
            <span className={styles.metricValueZero}>{dgQueue}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Staff-hours / day</span>
            <span className={styles.metricValueZero}>{dgHours}</span>
          </div>
        </div>
      </div>

      <div className={styles.callout}>
        <p className={styles.calloutHeadline}>
          You save {hoursSaved.toFixed(1)} hours/day &mdash; $
          {costSavedMonth.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          /month in unnecessary reviews
        </p>
        <p className={styles.calloutSub}>
          Blended false-positive rate: {(blendedRate * 100).toFixed(1)}% across{" "}
          {ACCENT_KEYS.filter((k) => accents[k] > 0).length} accent group
          {ACCENT_KEYS.filter((k) => accents[k] > 0).length !== 1 ? "s" : ""} at
          0.85 confidence threshold (Deepgram: 0%)
        </p>
      </div>

      <p className={styles.note}>
        Review hours assume calls flagged below 0.85 confidence threshold.
        Actual error rate &asymp; 0% &mdash; reviews are false positives.
      </p>
    </div>
  );
}
