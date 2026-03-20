import type { DeploymentGuardCallout } from "../types/cqs";
import styles from "./DeploymentGuardCallout.module.css";

export default function DeploymentGuardCalloutCard({
  guards,
}: {
  guards: DeploymentGuardCallout[];
}) {
  if (guards.length === 0) return null;

  const hasRequired = guards.some((g) => g.severity === "required");

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        {hasRequired ? "⚠️ Deployment Guard Required" : "Deployment Guards"}
      </h2>

      {guards.map((guard, i) => (
        <div key={i} className={styles.guardItem}>
          <div className={styles.guardHeader}>
            <span
              className={
                guard.severity === "required"
                  ? styles.badgeRequired
                  : styles.badgeRecommended
              }
            >
              {guard.severity}
            </span>
            <span className={styles.guardType}>{guard.guard_type}</span>
          </div>

          {guard.affected_languages.length > 0 && (
            <div className={styles.languages}>
              {guard.affected_languages.map((lang) => (
                <span key={lang} className={styles.langTag}>
                  {lang}
                </span>
              ))}
            </div>
          )}

          {guard.threshold !== undefined && (
            <div className={styles.threshold}>
              ⚠ Set confidence_threshold: {guard.threshold}
            </div>
          )}

          <p className={styles.description}>{guard.description}</p>
        </div>
      ))}
    </div>
  );
}
