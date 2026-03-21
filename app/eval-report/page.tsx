import type { AccentGroupData, ModelScorecardData, SilentFailureRisk, DeploymentGuardCallout, ProbeOverview, KnownBehavior } from "../types/cqs";
import AccentBreakdownTable from "../components/AccentBreakdownTable";
import CqsRecommendations from "../components/CqsRecommendations";
import ModelScorecard from "../components/ModelScorecard";
import SilentFailureRiskBadge from "../components/SilentFailureRiskBadge";
import DeploymentGuardCalloutCard from "../components/DeploymentGuardCallout";
import EastAsianDeploymentGuidanceCard from "../components/EastAsianDeploymentGuidance";
import KnownBehaviorsCard from "../components/KnownBehaviors";
import { computeSilentFailureRisk } from "@/lib/silent-failure-risk";
import { computeDeploymentGuards, computeEastAsianGuidance } from "@/lib/deployment-guards";
import { getKnownBehaviors } from "@/lib/known-behaviors";
import styles from "./page.module.css";

import ReviewCostCalculator from "../components/ReviewCostCalculator";
import HardClipCallout from "../components/HardClipCallout";
import CqsContrastCard from "../components/CqsContrastCard";
import SentimentOodCard from "../components/SentimentOodCard";

const FALLBACK_ACCENT_DATA: AccentGroupData[] = [
  { accent: "East Asian", wer: 6.2, ece: 0.024, cqs: "high", clips: 847 },
  { accent: "Hindi", wer: 5.8, ece: 0.022, cqs: "high", clips: 612 },
  { accent: "Arabic", wer: 7.4, ece: 0.018, cqs: "high", clips: 480 },
  { accent: "Farsi", wer: 9.1, ece: 0.053, cqs: "high", clips: 203 },
  { accent: "Spanish", wer: 11.4, ece: 0.042, cqs: "moderate", clips: 934 },
  { accent: "French", wer: 7.1, ece: 0.013, cqs: "moderate", clips: 320 },
  { accent: "German", wer: 5.9, ece: 0.015, cqs: "moderate", clips: 280 },
];

const FALLBACK_SCORECARD: ModelScorecardData = {
  model: "assemblyai/universal-2",
  evalDate: "2026-03-19",
  totalClips: 2792,
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
  probeOverview?: ProbeOverview;
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
      probeOverview: json.probeOverview,
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
  let deploymentGuards: DeploymentGuardCallout[] = computeDeploymentGuards("assemblyai");
  let probeOverview: ProbeOverview | null = null;
  const knownBehaviors: KnownBehavior[] = getKnownBehaviors("assemblyai");

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
      if (live.probeOverview) {
        probeOverview = live.probeOverview;
      }
    }
  }

  const vendorKey = scorecard.model.toLowerCase().includes("assemblyai") ? "assemblyai" : scorecard.model.split("/")[0];
  const eastAsianGuidance = computeEastAsianGuidance(vendorKey, accentData, true);

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
        <SilentFailureRiskBadge risk={silentFailureRisk} probeOverview={probeOverview} />
        <ReviewCostCalculator />
        <DeploymentGuardCalloutCard guards={deploymentGuards} />
        <EastAsianDeploymentGuidanceCard guidance={eastAsianGuidance} />
        <KnownBehaviorsCard behaviors={knownBehaviors} />
        <AccentBreakdownTable data={accentData} />
        <CqsRecommendations data={accentData} />
        <HardClipCallout />
        <CqsContrastCard />
        <SentimentOodCard result={{ id_accuracy: 0.8172, ood_accuracy: 0.7083, degradation_delta: 0.1089, degradation_tier: "significant", id_n: 3600, ood_n: 720 }} />
      </div>
    </div>
  );
}
