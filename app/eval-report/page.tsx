import type { AccentGroupData, ModelScorecardData } from "../types/cqs";
import AccentBreakdownTable from "../components/AccentBreakdownTable";
import ModelScorecard from "../components/ModelScorecard";
import styles from "./page.module.css";

const ACCENT_DATA: AccentGroupData[] = [
  { accent: "East Asian", wer: 6.2, ece: 0.024, cqs: "high", clips: 847 },
  { accent: "French", wer: 7.1, ece: 0.025, cqs: "high", clips: 612 },
  { accent: "Spanish", wer: 11.4, ece: 0.042, cqs: "moderate", clips: 934 },
  { accent: "Farsi", wer: 13.8, ece: 0.048, cqs: "moderate", clips: 203 },
];

const SCORECARD_DATA: ModelScorecardData = {
  model: "openai/whisper-large-v3",
  evalDate: "2026-03-19",
  totalClips: 2596,
  overallWer: 9.6,
  ece: 0.034,
  threshold: 4.0,
  accentGroups: ACCENT_DATA,
};

export default function EvalReportPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Eval Report</h1>
        <p className={styles.subtitle}>
          Calibration quality analysis for{" "}
          <span className={styles.mono}>openai/whisper-large-v3</span>
        </p>
      </header>

      <div className={styles.grid}>
        <ModelScorecard data={SCORECARD_DATA} />
        <AccentBreakdownTable data={ACCENT_DATA} />
      </div>
    </div>
  );
}
