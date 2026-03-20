export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>Agora.</h1>
      <p style={{ color: "#888", fontSize: "1.1rem", marginBottom: "3rem" }}>
        benchmark any AI vendor on your data.
      </p>

      <div
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: "8px",
          padding: "1.5rem",
          maxWidth: "640px",
          width: "100%",
          fontSize: "0.85rem",
          lineHeight: 1.6,
          overflowX: "auto",
        }}
      >
        <p style={{ color: "#666", margin: "0 0 0.5rem" }}># generate a key</p>
        <pre style={{ margin: "0 0 1rem", color: "#4ade80" }}>
{`curl -X POST https://your-host/api/v1/keys`}
        </pre>

        <p style={{ color: "#666", margin: "0 0 0.5rem" }}># run an eval</p>
        <pre style={{ margin: "0 0 1rem", color: "#4ade80" }}>
{`curl -X POST https://your-host/api/v1/eval \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_KEY" \\
  -d '{"audio_url": "https://example.com/audio.wav"}'`}
        </pre>

        <p style={{ color: "#666", margin: "0 0 0.5rem" }}>
          # get results
        </p>
        <pre style={{ margin: 0, color: "#4ade80" }}>
{`curl https://your-host/api/v1/eval/EVAL_ID`}
        </pre>
      </div>

      <div
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: "8px",
          padding: "1.5rem 2rem",
          maxWidth: "640px",
          width: "100%",
          marginTop: "2rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.1rem",
            color: "#e5e5e5",
            margin: "0 0 1.25rem",
            fontWeight: 600,
          }}
        >
          Statistical Rigor
        </h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          <li
            style={{
              borderLeft: "2px solid #4ade80",
              paddingLeft: "1rem",
              marginBottom: "1.25rem",
              color: "#a3a3a3",
              fontSize: "0.8rem",
              lineHeight: 1.7,
            }}
          >
            Both leading commercial ASR vendors are significantly
            worse-calibrated than open-source Whisper on spontaneous speech —
            AssemblyAI Universal-2 and Deepgram Nova-3 produced ECE scores of
            0.154 and 0.104 vs. Whisper&apos;s 0.031, measured on the AMI
            Meeting Corpus (n=30 clips, p=0.0005 and p=0.016 respectively,
            bootstrap with 20,000 iterations, 95% CI fully above zero for both
            comparisons).
          </li>
          <li
            style={{
              borderLeft: "2px solid #4ade80",
              paddingLeft: "1rem",
              marginBottom: "1.25rem",
              color: "#a3a3a3",
              fontSize: "0.8rem",
              lineHeight: 1.7,
            }}
          >
            AssemblyAI&apos;s confidence scores are highly unreliable on
            real-world speech: the model reports 99%+ confidence on clips where
            it misses 30–50% of words, a 15× degradation compared to its
            read-speech ECE (0.006 → 0.154). This overconfidence gap is
            statistically significant (p=0.0005) and has direct downstream
            consequences for any system relying on ASR confidence thresholds.
          </li>
          <li
            style={{
              borderLeft: "2px solid #4ade80",
              paddingLeft: "1rem",
              color: "#a3a3a3",
              fontSize: "0.8rem",
              lineHeight: 1.7,
            }}
          >
            Agora&apos;s vendor evaluations are statistically powered: all
            calibration claims are backed by bootstrap significance testing
            (20,000 iterations, percentile CIs) on matched audio across vendors.
            Directional findings are confirmed — not estimated — before they
            appear in any report.
          </li>
        </ul>
      </div>

      <a
        href="/compare"
        style={{
          color: "#4ade80",
          fontSize: "0.9rem",
          marginTop: "2rem",
          display: "block",
          textAlign: "center",
          textDecoration: "none",
        }}
      >
        Compare vendors →
      </a>
    </main>
  );
}
