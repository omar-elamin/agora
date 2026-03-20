import styles from "./HardClipCallout.module.css";

const HARD_CLIPS = [
  { id: "spanish3", confidence: 0.562, accuracy: 0.0 },
  { id: "spanish21", confidence: 0.585, accuracy: 0.0 },
];

export default function HardClipCallout() {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Hard Clip Detection — Routing Failures</h3>
      <p className={styles.subtitle}>
        From the Spanish (n=50) Low CQS group — confidence scores cannot be trusted for routing.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Clip</th>
            <th>Confidence</th>
            <th>Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {HARD_CLIPS.map((clip) => (
            <tr key={clip.id} className={styles.failureRow}>
              <td className={styles.mono}>{clip.id}</td>
              <td className={styles.mono}>{clip.confidence.toFixed(3)}</td>
              <td className={styles.mono}>{clip.accuracy.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.warning}>
        These clips received moderate confidence scores (0.56–0.59) but produced
        zero-accuracy transcripts. Confidence-based routing would have sent these
        to automation — Agora catches them.
      </div>
      <div className={styles.contrast}>
        Hindi callers at similar confidence levels (0.55–0.75) maintain 94%+
        accuracy. Spanish n=50 drops to 0%.
      </div>
    </div>
  );
}
