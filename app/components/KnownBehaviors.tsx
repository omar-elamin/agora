import type { KnownBehavior } from "../types/cqs";
import styles from "./KnownBehaviors.module.css";

const badgeClass: Record<KnownBehavior["severity"], string> = {
  critical: styles.badgeCritical,
  warning: styles.badgeWarning,
  info: styles.badgeInfo,
};

const recommendationClass: Record<KnownBehavior["severity"], string> = {
  critical: styles.recommendationCritical,
  warning: styles.recommendationWarning,
  info: styles.recommendationInfo,
};

export default function KnownBehaviors({
  behaviors,
}: {
  behaviors: KnownBehavior[];
}) {
  if (behaviors.length === 0) return null;

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>🔍 Known Behaviors</h2>

      {behaviors.map((b) => (
        <div key={b.id} className={styles.behaviorItem}>
          <div className={styles.behaviorHeader}>
            <span className={badgeClass[b.severity]}>{b.severity}</span>
            <span className={styles.behaviorTitle}>{b.title}</span>
          </div>

          <p className={styles.summary}>{b.summary}</p>

          <div className={styles.detail}>{b.detail}</div>

          {b.affected_params.length > 0 && (
            <div className={styles.params}>
              {b.affected_params.map((p) => (
                <span key={p} className={styles.paramTag}>
                  {p}
                </span>
              ))}
            </div>
          )}

          <div className={recommendationClass[b.severity]}>
            {b.recommendation}
          </div>
        </div>
      ))}
    </div>
  );
}
