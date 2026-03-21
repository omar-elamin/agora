import styles from "./SentimentOodCard.module.css";

interface SentimentOodResult {
  id_accuracy: number;
  ood_accuracy: number;
  degradation_delta: number;
  degradation_tier: "robust" | "moderate" | "significant";
  id_n: number;
  ood_n: number;
}

interface SentimentOodCardProps {
  result?: SentimentOodResult | null;
}

function tierBadgeClass(tier: SentimentOodResult["degradation_tier"]): string {
  if (tier === "robust") return styles.badgeRobust;
  if (tier === "moderate") return styles.badgeModerate;
  return styles.badgeSignificant;
}

function deltaColorClass(tier: SentimentOodResult["degradation_tier"]): string {
  if (tier === "robust") return styles.deltaGreen;
  if (tier === "moderate") return styles.deltaYellow;
  return styles.deltaRed;
}

export default function SentimentOodCard({ result }: SentimentOodCardProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>
        Sentiment Analysis &mdash; OOD Robustness
      </h3>

      {result ? (
        <>
          <div className={styles.row}>
            <span className={styles.label}>ID Accuracy</span>
            <span className={styles.value}>
              {(result.id_accuracy * 100).toFixed(1)}% (n={result.id_n})
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>OOD Accuracy</span>
            <span className={styles.value}>
              {(result.ood_accuracy * 100).toFixed(1)}% (n={result.ood_n})
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Degradation</span>
            <span
              className={`${styles.value} ${deltaColorClass(result.degradation_tier)}`}
            >
              &#9660; {(result.degradation_delta * 100).toFixed(1)} pp
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Tier</span>
            <span className={styles.value}>
              <span
                className={`${styles.badge} ${tierBadgeClass(result.degradation_tier)}`}
              >
                {result.degradation_tier}
              </span>
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Shift Type</span>
            <span className={styles.value}>
              Adversarial subpopulation shift
            </span>
          </div>
          <p className={styles.footnote}>
            DynaSent (Potts et al., ACL 2021) &mdash; CC BY 4.0
          </p>
        </>
      ) : (
        <p className={styles.placeholder}>
          Sentiment OOD eval not yet run for this model.
        </p>
      )}
    </div>
  );
}
