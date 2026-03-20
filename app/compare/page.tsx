import { computeSilentFailureRisk } from "@/lib/silent-failure-risk";
import SilentFailureRiskBadge from "@/app/components/SilentFailureRiskBadge";
import styles from "./page.module.css";

const vendors = [
  {
    name: "AssemblyAI",
    model: "Universal-2",
    risk: computeSilentFailureRisk({
      vendor: "assemblyai",
      wer: null,
      routing_failure: true,
      routing_failure_reason: "language detection misfire",
    }),
  },
  {
    name: "Deepgram",
    model: "Nova-3",
    risk: computeSilentFailureRisk({
      vendor: "deepgram",
      wer: null,
      routing_failure: false,
      routing_failure_reason: null,
    }),
  },
  {
    name: "Whisper",
    model: "large-v3",
    risk: computeSilentFailureRisk({
      vendor: "whisper-large-v3",
      wer: null,
      routing_failure: false,
      routing_failure_reason: null,
    }),
  },
];

export default function ComparePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Vendor Comparison</h1>
        <p className={styles.subtitle}>
          Silent failure risk across ASR vendors
        </p>
      </header>

      <div className={styles.grid}>
        {vendors.map((v) => (
          <div key={v.name} className={styles.vendorCard}>
            <h2 className={styles.vendorName}>{v.name}</h2>
            <p className={styles.modelName}>{v.model}</p>
            <SilentFailureRiskBadge risk={v.risk} />
          </div>
        ))}
      </div>

      <div className={styles.header}>
        <a href="/" className={styles.backLink}>
          &larr; Home
        </a>
      </div>
    </div>
  );
}
