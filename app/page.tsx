export default function Home() {
  return (
    <>
      <style>{`
        .landing {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 6rem 2rem 4rem;
          max-width: 720px;
          margin: 0 auto;
        }
        .headline {
          font-size: 2.6rem;
          line-height: 1.15;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #e5e5e5;
          margin: 0 0 1.5rem;
        }
        .subhead {
          color: #a3a3a3;
          font-size: 1rem;
          line-height: 1.7;
          margin: 0 0 1.5rem;
          max-width: 600px;
        }
        .value-prop {
          color: #888;
          font-size: 0.95rem;
          line-height: 1.7;
          margin: 0 0 2.5rem;
          max-width: 600px;
        }
        .callout {
          width: 100%;
          border-left: 3px solid #22c55e;
          background: rgba(34, 197, 94, 0.05);
          padding: 1.25rem 1.5rem;
          margin: 0 0 3rem;
          border-radius: 0 6px 6px 0;
        }
        .callout-label {
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #22c55e;
          margin: 0 0 0.75rem;
          font-weight: 600;
        }
        .callout-text {
          color: #c4c4c4;
          font-size: 0.88rem;
          line-height: 1.65;
          margin: 0;
        }
        .cta-row {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          align-items: flex-start;
        }
        .cta {
          display: inline-flex;
          align-items: center;
          background: #e5e5e5;
          color: #0a0a0a;
          border: none;
          border-radius: 5px;
          padding: 0.7rem 1.6rem;
          font-size: 0.9rem;
          font-family: inherit;
          font-weight: 600;
          text-decoration: none;
          letter-spacing: -0.01em;
          transition: background 0.15s;
        }
        .cta:hover { background: #fff; }
        .cta-note {
          color: #444;
          font-size: 0.8rem;
          line-height: 1.5;
          max-width: 480px;
        }
        .divider {
          width: 100%;
          border: none;
          border-top: 1px solid #1a1a1a;
          margin: 4rem 0 3rem;
        }
        .api-label {
          color: #444;
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin: 0 0 1rem;
          font-weight: 600;
        }
        .snippet {
          width: 100%;
          background: #111;
          border: 1px solid #1e1e1e;
          border-radius: 6px;
          padding: 1.5rem;
          overflow-x: auto;
        }
        .snippet pre {
          margin: 0;
          font-size: 0.8rem;
          line-height: 1.75;
          color: #4ade80;
          white-space: pre;
        }
        .snippet .cm { color: #383838; }
      `}</style>

      <main className="landing">
        <h1 className="headline">
          Vendors don&apos;t show you how they fail.<br />
          Agora does.
        </h1>

        <p className="subhead">
          Every ASR vendor publishes accuracy numbers on clean audio. Those numbers are real.
          They just don&apos;t tell you what happens when your audio isn&apos;t clean — and they
          definitely don&apos;t tell you when a wrong answer looks like a right one.
        </p>

        <p className="value-prop">
          Agora runs your audio across the vendors you&apos;re evaluating and surfaces what they
          can&apos;t — or won&apos;t — show you: which failure modes are silent, which are
          catchable, and which one you can actually live with.
        </p>

        <div className="callout">
          <div className="callout-label">What we found</div>
          <p className="callout-text">
            AssemblyAI returned 88% confidence on a Spanish-accent transcript that was 37% wrong.
            No flag. No alert. A standard confidence threshold would have let it through.
            That&apos;s not an accuracy problem. That&apos;s a silent failure problem.
            And vendor benchmarks don&apos;t show it.
          </p>
        </div>

        <div className="cta-row">
          <a href="mailto:rachel@caretta.so?subject=Agora early access" className="cta">
            Request early access →
          </a>
          <p className="cta-note">
            No clean-audio demos. No generic benchmarks.<br />
            Just your audio, your conditions, your failure modes.
          </p>
        </div>

        <hr className="divider" />

        <div className="api-label">API</div>

        <div className="snippet">
          <pre>{`# generate a key
curl -X POST https://agora-agora-hq.vercel.app/api/v1/keys

# run an eval
curl -X POST https://agora-agora-hq.vercel.app/api/v1/eval \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_KEY" \\
  -d '{"audio_url": "https://example.com/clip.wav"}'

# get results
curl https://agora-agora-hq.vercel.app/api/v1/eval/EVAL_ID`}</pre>
        </div>
      </main>
    </>
  );
}
