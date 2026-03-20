"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ReviewCostCalculator.module.css";

const AAI_FALSE_POSITIVE_RATE = 0.667;
const WORKING_DAYS_PER_MONTH = 22;

export interface ReviewCostValues {
  pctWa: number;
  callsPerDay: number;
  minutesPerReview: number;
  hourlyRate: number;
}

interface ReviewCostCalculatorProps {
  defaultPctWa?: number;
  defaultCallsPerDay?: number;
  defaultMinutesPerReview?: number;
  defaultHourlyRate?: number;
  onChange?: (values: ReviewCostValues) => void;
}

export default function ReviewCostCalculator({
  defaultPctWa = 20,
  defaultCallsPerDay = 1000,
  defaultMinutesPerReview = 15,
  defaultHourlyRate = 25,
  onChange,
}: ReviewCostCalculatorProps = {}) {
  const [pctWa, setPctWa] = useState(defaultPctWa);
  const [callsPerDay, setCallsPerDay] = useState(defaultCallsPerDay);
  const [minutesPerReview, setMinutesPerReview] = useState(defaultMinutesPerReview);
  const [hourlyRate, setHourlyRate] = useState(defaultHourlyRate);

  const stableOnChange = useCallback((v: ReviewCostValues) => { onChange?.(v); }, [onChange]);

  useEffect(() => {
    stableOnChange({ pctWa, callsPerDay, minutesPerReview, hourlyRate });
  }, [pctWa, callsPerDay, minutesPerReview, hourlyRate, stableOnChange]);

  const waCalls = callsPerDay * (pctWa / 100);
  const aaiQueue = waCalls * AAI_FALSE_POSITIVE_RATE;
  const dgQueue = 0;
  const aaiHours = (aaiQueue * minutesPerReview) / 60;
  const dgHours = 0;
  const hoursSaved = aaiHours - dgHours;
  const costSavedDay = hoursSaved * hourlyRate;
  const costSavedMonth = costSavedDay * WORKING_DAYS_PER_MONTH;

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Review Cost Calculator</h2>

      <div className={styles.inputs}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>% West African speakers</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={100}
              step={1}
              value={pctWa}
              onChange={(e) => setPctWa(Number(e.target.value))}
            />
            <span className={styles.sliderValue}>{pctWa}%</span>
          </div>
        </div>

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
          You save {hoursSaved.toFixed(1)} hours/day &mdash; ${costSavedMonth.toLocaleString("en-US", { maximumFractionDigits: 0 })}/month in unnecessary reviews
        </p>
        <p className={styles.calloutSub}>
          Based on 66.7% false-positive review rate on West African English at 0.85 confidence threshold (n=15, 4/4 accent groups)
        </p>
      </div>

      <p className={styles.note}>
        Review hours assume calls flagged below 0.85 confidence threshold. Actual error rate &asymp; 0% &mdash; reviews are false positives.
      </p>
    </div>
  );
}
