export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4rem 2rem 2rem",
      }}
    >
      {/* Hero */}
      <section
        style={{
          maxWidth: "720px",
          width: "100%",
          marginBottom: "3rem",
        }}
      >
        <h1
          style={{
            fontSize: "2.6rem",
            lineHeight: 1.15,
            marginBottom: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Vendors don&apos;t show you how they fail.
          <br />
          Agora does.
        </h1>

        <p
          style={{
            color: "#a3a3a3",
            fontSize: "1.1rem",
            lineHeight: 1.7,
            marginBottom: "1.5rem",
          }}
        >
          Every ASR vendor publishes accuracy numbers on clean audio. Those
          numbers are real. They just don&apos;t tell you what happens when your
          audio isn&apos;t clean&nbsp;&mdash; and they definitely don&apos;t tell
          you when a wrong answer looks like a right one.
        </p>

        <p
          style={{
            color: "#d4d4d4",
            fontSize: "1rem",
            lineHeight: 1.7,
            marginBottom: "2.5rem",
          }}
        >
          Agora runs your audio across the vendors you&apos;re evaluating and
          surfaces what they can&apos;t&nbsp;&mdash; or won&apos;t&nbsp;&mdash;
          show you: which failure modes are silent, which are catchable, and
          which one you can actually live with.
        </p>

        {/* Callout / pull quote */}
        <blockquote
          style={{
            borderLeft: "3px solid #4ade80",
            margin: "0 0 2.5rem",
            padding: "1.25rem 1.5rem",
            backgroundColor: "rgba(74, 222, 128, 0.05)",
            borderRadius: "0 6px 6px 0",
            color: "#d4d4d4",
            fontSize: "0.9rem",
            lineHeight: 1.75,
            fontStyle: "italic",
          }}
        >
          <strong style={{ color: "#e5e5e5", fontStyle: "normal" }}>
            What we found:
          </strong>{" "}
          AssemblyAI returned 88% confidence on a Spanish-accent transcript that
          was 37% wrong. No flag. No alert. A standard confidence threshold
          would have let it through. That&apos;s not an accuracy
          problem. That&apos;s a silent failure problem. And vendor benchmarks
          don&apos;t show it.
        </blockquote>

        {/* CTA */}
        <div style={{ marginBottom: "1rem" }}>
          <a
            href="mailto:rachel@caretta.so"
            style={{
              display: "inline-block",
              backgroundColor: "#4ade80",
              color: "#0a0a0a",
              fontWeight: 600,
              fontSize: "1rem",
              padding: "0.75rem 1.75rem",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Request early access &rarr;
          </a>
        </div>
        <p
          style={{
            color: "#737373",
            fontSize: "0.85rem",
            lineHeight: 1.6,
          }}
        >
          No clean-audio demos. No generic benchmarks. Just your audio, your
          conditions, your failure modes.
        </p>
      </section>

      {/* API curl examples */}
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
{`curl -X POST https://agora-agora-hq.vercel.app/api/v1/keys`}
        </pre>

        <p style={{ color: "#666", margin: "0 0 0.5rem" }}># run an eval</p>
        <pre style={{ margin: "0 0 1rem", color: "#4ade80" }}>
{`curl -X POST https://agora-agora-hq.vercel.app/api/v1/eval \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_KEY" \\
  -d '{"audio_url": "https://example.com/audio.wav"}'`}
        </pre>

        <p style={{ color: "#666", margin: "0 0 0.5rem" }}>
          # get results
        </p>
        <pre style={{ margin: 0, color: "#4ade80" }}>
{`curl https://agora-agora-hq.vercel.app/api/v1/eval/EVAL_ID`}
        </pre>
      </div>

      {/* Statistical Rigor */}
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
