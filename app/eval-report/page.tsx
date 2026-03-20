import type { AccentGroupData, ModelScorecardData, SilentFailureRisk, DeploymentGuardCallout } from "../types/cqs";
import AccentBreakdownTable from "../components/AccentBreakdownTable";
import ModelScorecard from "../components/ModelScorecard";
import SilentFailureRiskBadge from "../components/SilentFailureRiskBadge";
import DeploymentGuardCalloutCard from "../components/DeploymentGuardCallout";
import { computeSilentFailureRisk } from "@/lib/silent-failure-risk";
import { computeDeploymentGuards } from "@/lib/deployment-guards";
import styles from "./page.module.css";

const FALLBACK_ACCENT_DATA: AccentGroupData[] = [
  { accent: "East Asian", wer: 6.2, ece: 0.024, cqs: "high", clips: 847 },
  { accent: "French", wer: 7.1, ece: 0.025, cqs: "high", clips: 612 },
  { accent: "Spanish", wer: 11.4, ece: 0.042, cqs: "moderate", clips: 934 },
  { accent: "Farsi", wer: 13.8, ece: 0.048, cqs: "moderate", clips: 203 },
];

const FALLBACK_SCORECARD: ModelScorecardData = {
  model: "openai/whisper-large-v3",
  evalDate: "2026-03-19",
  totalClips: 2596,
  overallWer: 9.6,
  ece: 0.034,
  threshold: 4.0,
  accentGroups: FALLBACK_ACCENT_DATA,
};

async function fetchReportData(
  evalId: string,
): Promise<{
  scorecard: ModelScorecardData;
  accentGroups: AccentGroupData[];
  silentFailureRisk?: SilentFailureRisk;
  deploymentGuards?: DeploymentGuardCallout[];
} | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/v1/eval/${evalId}/report`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      scorecard: json.scorecard,
      accentGroups: json.accentGroups,
      silentFailureRisk: json.silentFailureRisk,
      deploymentGuards: json.deploymentGuards,
    };
  } catch {
    return null;
  }
}

export default async function EvalReportPage({
  searchParams,
}: {
  searchParams: Promise<{ evalId?: string }>;
}) {
  const { evalId } = await searchParams;

  let scorecard = FALLBACK_SCORECARD;
  let accentData: AccentGroupData[] = FALLBACK_ACCENT_DATA;
  let silentFailureRisk: SilentFailureRisk = computeSilentFailureRisk({
    vendor: "assemblyai",
    wer: null,
    routing_failure: true,
    routing_failure_reason: null,
  });
  let deploymentGuards: DeploymentGuardCallout[] = computeDeploymentGuards("assemblyai", silentFailureRisk);

  if (evalId) {
    const live = await fetchReportData(evalId);
    if (live) {
      scorecard = live.scorecard;
      accentData = live.accentGroups;
      if (live.silentFailureRisk) {
        silentFailureRisk = live.silentFailureRisk;
      }
      if (live.deploymentGuards) {
        deploymentGuards = live.deploymentGuards;
      }
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Eval Report</h1>
        <p className={styles.subtitle}>
          Calibration quality analysis for{" "}
          <span className={styles.mono}>{scorecard.model}</span>
        </p>
      </header>

      <div className={styles.grid}>
        <ModelScorecard data={scorecard} />
        <SilentFailureRiskBadge risk={silentFailureRisk} />
        <DeploymentGuardCalloutCard guards={deploymentGuards} />
        <AccentBreakdownTable data={accentData} />
      </div>
    </div>
  );
}
