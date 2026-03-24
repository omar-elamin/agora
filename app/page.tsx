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
        .charts-section {
          width: 100%;
          margin: 0 0 3rem;
        }
        .charts-label {
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #22c55e;
          font-weight: 600;
          margin: 0 0 1rem;
        }
        .charts-grid {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }
        .chart-img {
          width: 100%;
          border-radius: 8px;
          border: 1px solid #1e1e1e;
        }
        .chart-caption {
          color: #666;
          font-size: 0.75rem;
          margin: 0.5rem 0 0;
          line-height: 1.5;
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
          background: #22c55e;
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
        .cta:hover { background: #4ade80; }
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
        .pricing {
          display: flex;
          gap: 1.5rem;
          width: 100%;
        }
        .pricing-card {
          flex: 1;
          border: 1px solid #1e1e1e;
          border-radius: 6px;
          padding: 1.5rem;
          background: #111;
        }
        .pricing-tier {
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #22c55e;
          font-weight: 600;
          margin: 0 0 0.5rem;
        }
        .pricing-amount {
          font-size: 2rem;
          font-weight: 700;
          color: #e5e5e5;
          margin: 0 0 0.5rem;
        }
        .pricing-detail {
          color: #a3a3a3;
          font-size: 0.85rem;
          line-height: 1.6;
          margin: 0;
        }
        .integrations-section {
          width: 100%;
        }
        .integrations-subhead {
          color: #a3a3a3;
          font-size: 0.95rem;
          line-height: 1.7;
          margin: 0 0 2.5rem;
          max-width: 600px;
        }
        .integration-block {
          margin: 0 0 2.5rem;
        }
        .integration-title {
          color: #22c55e;
          font-size: 0.95rem;
          font-weight: 600;
          margin: 0 0 0.75rem;
        }
        .integration-text {
          color: #a3a3a3;
          font-size: 0.88rem;
          line-height: 1.7;
          margin: 0 0 1rem;
        }
        .integration-text strong {
          color: #c4c4c4;
          font-weight: 600;
        }
        .integration-list {
          list-style: none;
          padding: 0;
          margin: 0 0 1rem;
        }
        .integration-list li {
          color: #a3a3a3;
          font-size: 0.88rem;
          line-height: 1.7;
          padding-left: 1.2rem;
          position: relative;
        }
        .integration-list li::before {
          content: "—";
          position: absolute;
          left: 0;
          color: #444;
        }
        .integration-table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 0 1.5rem;
          font-size: 0.85rem;
          font-family: var(--font-mono, monospace);
        }
        .integration-table th,
        .integration-table td {
          border: 1px solid #1e1e1e;
          padding: 0.6rem 1rem;
          text-align: left;
        }
        .integration-table th {
          color: #e5e5e5;
          font-weight: 600;
          background: #111;
        }
        .integration-table td {
          color: #a3a3a3;
        }
        .integration-table td:first-child {
          color: #666;
          font-size: 0.8rem;
        }
        .integration-note {
          color: #666;
          font-size: 0.85rem;
          line-height: 1.6;
          margin: 0 0 1.5rem;
          font-style: italic;
        }
        .integration-cta {
          color: #22c55e;
          font-size: 0.88rem;
          text-decoration: none;
          transition: color 0.15s;
        }
        .integration-cta:hover {
          color: #4ade80;
        }
      `}</style>

      <main className="landing">
        <h1 className="headline">
          Vendors don&apos;t show you how they fail.<br />
          Agora does.
        </h1>

        <p className="subhead">
          Vendor accuracy numbers are real — but only on clean audio. Agora runs your audio
          across the vendors you&apos;re evaluating and surfaces what they won&apos;t: which
          failure modes are silent, which are catchable, and which you can live with.
        </p>

        <div className="callout">
          <div className="callout-label">What we found</div>
          <p className="callout-text">
            88% confidence. 37% wrong. AssemblyAI returned that on a Spanish-accent transcript —
            no flag, no alert. A standard confidence threshold would have let it through.
            That&apos;s not an accuracy problem. That&apos;s a silent failure problem.
          </p>
        </div>

        <div className="callout">
          <div className="callout-label">Latency — validated</div>
          <p className="callout-text">
            Sub-500ms P95 utterance-to-transcript, validated at production call pace. Median 385ms,
            P95 470ms across 18 utterances at 1x realtime. Arabic-mixed calls show no degradation —
            P95 delta &lt;2ms. This is the number that determines whether rep-assist is usable or
            noise.
          </p>
        </div>

        <div className="charts-section">
          <div className="charts-label">Adaptive calibration — real results</div>
          <div className="charts-grid">
            <div>
              <img src="/charts/03-summary-slide.png" alt="Agora adaptive-T calibration summary — ECE reduced 54%, accuracy preserved" className="chart-img" />
              <p className="chart-caption">
                Adaptive temperature scaling reduced expected calibration error by 54% while preserving transcription accuracy. Tested on real-world multilingual audio.
              </p>
            </div>
            <div>
              <img src="/charts/01-ece-comparison-bar.png" alt="ECE comparison — before vs after adaptive-T calibration" className="chart-img" />
              <p className="chart-caption">
                Expected Calibration Error (ECE) before and after adaptive-T across vendor models. Lower is better.
              </p>
            </div>
          </div>
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

        <div className="api-label">Pricing</div>

        <div className="pricing">
          <div className="pricing-card">
            <div className="pricing-tier">Free tier</div>
            <div className="pricing-amount">$0</div>
            <p className="pricing-detail">First 5 evals per API key — no credit card required.</p>
          </div>
          <div className="pricing-card">
            <div className="pricing-tier">Per eval</div>
            <div className="pricing-amount">$0.10</div>
            <p className="pricing-detail">After the free tier. Billed per eval via Stripe. Add a payment method to continue.</p>
          </div>
        </div>

        <div className="cta-row" style={{ marginTop: "2rem" }}>
          <a href="/api/v1/keys" className="cta" style={{ cursor: "default", pointerEvents: "none", opacity: 0.9 }}>
            Get API Key
          </a>
          <p className="cta-note">
            POST /api/v1/keys to generate a key. First 5 evals are free.
          </p>
        </div>

        <hr className="divider" />

        <div className="integrations-section">
          <div className="api-label">integrations — not all audio is equal</div>
          <p className="integrations-subhead">
            agora works with Aircall, Zoom, and Twilio. they all connect. they don&apos;t all perform the same.
          </p>

          <div className="integration-block">
            <div className="integration-title">zoom + twilio — full accuracy</div>
            <p className="integration-text">
              zoom and twilio give agora two separate audio tracks: one for your rep, one for the customer.
              no guessing, no mixing. agora knows exactly who said what, routes multilingual speech correctly,
              and delivers eval scores you can trust.
            </p>
            <p className="integration-text">
              <strong>best for:</strong> multilingual call centers, MENA/LATAM/South Asia teams, high-volume
              accounts, any use case where rep vs. customer accuracy matters most
            </p>
          </div>

          <div className="integration-block">
            <div className="integration-title">aircall — supported, with a caveat</div>
            <p className="integration-text">
              aircall is fully supported. but we&apos;re going to be upfront with you.
            </p>
            <p className="integration-text">
              aircall delivers a single mixed audio file — both voices in one track. agora uses speaker
              diarization to separate rep from customer, and it works well for standard english calls.
              but it&apos;s not the same as having two clean channels.
            </p>
            <p className="integration-text"><strong>where aircall falls short:</strong></p>
            <ul className="integration-list">
              <li>
                <strong>bilingual calls</strong> — if your reps switch between languages mid-call, or handle
                calls in arabic, spanish, french alongside english, accuracy drops materially. diarization on
                mixed mono was not built for this.
              </li>
              <li>
                <strong>acoustically similar voices</strong> — rare, but on calls where the voices are too
                similar, the model can&apos;t reliably tell them apart
              </li>
              <li>
                <strong>confidence</strong> — aircall segments are flagged in your dashboard so you always know
                which calls came from mono audio
              </li>
            </ul>
            <p className="integration-text">
              aircall is a great fit if your calls are english-dominant and you&apos;re not doing high-volume
              multilingual work. if you are — zoom or twilio will serve you significantly better.
            </p>
          </div>

          <table className="integration-table">
            <thead>
              <tr>
                <th></th>
                <th>zoom</th>
                <th>twilio</th>
                <th>aircall</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>per-speaker audio</td>
                <td>✅</td>
                <td>✅</td>
                <td>❌ mono only</td>
              </tr>
              <tr>
                <td>multilingual accuracy</td>
                <td>✅</td>
                <td>✅</td>
                <td>❌ unreliable</td>
              </tr>
              <tr>
                <td>english-only accuracy</td>
                <td>✅</td>
                <td>✅</td>
                <td>✅ good</td>
              </tr>
              <tr>
                <td>recommended tier</td>
                <td>A</td>
                <td>A</td>
                <td>B</td>
              </tr>
            </tbody>
          </table>

          <p className="integration-note">
            we&apos;d rather tell you this upfront than let you find it out after you&apos;ve connected your call center.
          </p>

          <a
            href="mailto:rachel@caretta.so?subject=Integration question"
            className="integration-cta"
          >
            questions about which integration fits your team? talk to us →
          </a>
        </div>

        <hr className="divider" />

        <div className="api-label">For developers</div>

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
