"use client";

import { useState } from "react";
import NavHeader from "../components/NavHeader";

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <style>{`
        .pricing-page {
          min-height: 100vh;
          background: #0a0a0a;
          color: #e5e5e5;
        }
        .pricing-body {
          max-width: 720px;
          margin: 0 auto;
          padding: 4rem 2rem 6rem;
        }
        .section {
          margin-bottom: 4rem;
        }
        .section-label {
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #22c55e;
          font-weight: 600;
          margin: 0 0 1.25rem;
        }
        .section-heading {
          font-size: 1.6rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #e5e5e5;
          margin: 0 0 1.25rem;
          text-transform: lowercase;
        }
        .body-text {
          color: #a3a3a3;
          font-size: 0.9rem;
          line-height: 1.75;
          margin: 0 0 1rem;
        }
        .body-text strong {
          color: #e5e5e5;
          font-weight: 600;
        }
        .body-text .green {
          color: #22c55e;
        }
        .bullet-list {
          list-style: none;
          padding: 0;
          margin: 0 0 1rem;
        }
        .bullet-list li {
          color: #a3a3a3;
          font-size: 0.9rem;
          line-height: 1.75;
          padding-left: 1.25rem;
          position: relative;
        }
        .bullet-list li::before {
          content: "–";
          position: absolute;
          left: 0;
          color: #444;
        }
        .divider {
          width: 100%;
          border: none;
          border-top: 1px solid #1a1a1a;
          margin: 0;
        }

        /* pricing tiers table */
        .tier-table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 0 1rem;
        }
        .tier-table th {
          text-align: left;
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #444;
          font-weight: 600;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #1e1e1e;
        }
        .tier-table td {
          font-size: 0.88rem;
          color: #a3a3a3;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #141414;
        }
        .tier-table tr:nth-child(even) td {
          background: #0e0e0e;
        }
        .tier-table td:first-child {
          color: #e5e5e5;
          font-weight: 600;
        }

        /* cost reference table */
        .cost-table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 0 0.75rem;
          font-size: 0.84rem;
        }
        .cost-table th {
          text-align: left;
          font-size: 0.65rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #444;
          font-weight: 600;
          padding: 0.75rem 0.75rem;
          border-bottom: 1px solid #1e1e1e;
        }
        .cost-table td {
          color: #a3a3a3;
          padding: 0.85rem 0.75rem;
          border-bottom: 1px solid #141414;
        }
        .cost-table tr:nth-child(even) td {
          background: #0e0e0e;
        }
        .cost-table td:first-child {
          color: #e5e5e5;
          font-weight: 600;
        }
        .cost-table .green-cell {
          color: #22c55e;
          font-weight: 700;
        }

        .footnote {
          color: #444;
          font-size: 0.75rem;
          line-height: 1.6;
          margin: 0.5rem 0 0;
        }
        .bridge {
          color: #555;
          font-size: 0.85rem;
          line-height: 1.7;
          margin: 1.5rem 0 0;
          font-style: italic;
        }
        .context-note {
          color: #555;
          font-size: 0.82rem;
          line-height: 1.65;
          margin: 0;
        }

        /* CTA */
        .cta-heading {
          font-size: 1.4rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #e5e5e5;
          margin: 0 0 0.75rem;
          text-transform: lowercase;
        }
        .cta-sub {
          color: #a3a3a3;
          font-size: 0.9rem;
          line-height: 1.75;
          margin: 0 0 1rem;
        }
        .cta-micro {
          color: #444;
          font-size: 0.8rem;
          margin: 0 0 1.25rem;
        }
        .cta-btn {
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
        .cta-btn:hover {
          background: #4ade80;
        }

        /* FAQ */
        .faq-item {
          border-bottom: 1px solid #1a1a1a;
        }
        .faq-q {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          background: none;
          border: none;
          padding: 1rem 0;
          color: #e5e5e5;
          font-size: 0.9rem;
          font-family: inherit;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
        }
        .faq-q:hover {
          color: #22c55e;
        }
        .faq-chevron {
          color: #444;
          font-size: 0.8rem;
          transition: transform 0.2s;
        }
        .faq-a {
          color: #a3a3a3;
          font-size: 0.88rem;
          line-height: 1.7;
          padding: 0 0 1rem;
          margin: 0;
        }
      `}</style>

      <div className="pricing-page">
        <NavHeader />
        <div className="pricing-body">

          {/* === 1. the cost you're not seeing === */}
          <section className="section">
            <div className="section-label">The problem</div>
            <h1 className="section-heading">the cost you&apos;re not seeing</h1>
            <ul className="bullet-list">
              <li>
                Deepgram returns <strong>0.95 confidence</strong> on a spanish-accented clip
                with <strong>39% WER</strong> — review queue sees nothing, errors go to CRM.
              </li>
              <li>
                AssemblyAI auto-detect routes <strong>17% of east asian english audio</strong> as
                the wrong language — 100% WER transcript delivered with no warning.
              </li>
              <li>
                At <strong>$50–200 per failed transcript</strong> in compliance use cases, this
                compounds fast.
              </li>
            </ul>
          </section>

          <hr className="divider" />

          {/* === 2. what routing actually fixes === */}
          <section className="section" style={{ marginTop: "3rem" }}>
            <div className="section-label">The fix</div>
            <h2 className="section-heading">what routing actually fixes</h2>
            <p className="body-text">
              Agora Smart Router runs two vendors in tandem.
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Deepgram</strong> handles language detection — 0% auto-detect failures
                across every accent group tested.
              </li>
              <li>
                <strong>AssemblyAI</strong> handles transcription — ECE 0.004–0.036
                vs Deepgram 0.035–0.090.
              </li>
            </ul>
            <p className="body-text">
              <span className="green">Zero language detection failures.</span>{" "}
              Confidence scores that route correctly. One API key.
            </p>
          </section>

          <hr className="divider" />

          {/* === 3. Pricing table === */}
          <section className="section" style={{ marginTop: "3rem" }}>
            <div className="section-label">Pricing</div>
            <h2 className="section-heading">simple, per-minute pricing</h2>
            <table className="tier-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Rate</th>
                  <th>Best for</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Starter</td>
                  <td>$0.028/min</td>
                  <td>up to 1,000 min/mo</td>
                </tr>
                <tr>
                  <td>Growth</td>
                  <td>$0.022/min</td>
                  <td>1,000–10,000 min/mo</td>
                </tr>
                <tr>
                  <td>Enterprise</td>
                  <td>custom</td>
                  <td>10,000+ min/mo, SLA, dual-channel</td>
                </tr>
              </tbody>
            </table>
            <p className="context-note">
              Deepgram alone is $0.0043/min. The delta (~$0.024/min at Starter) is what zero
              silent failures costs.
            </p>
          </section>

          <hr className="divider" />

          {/* === 4. Cost reference table === */}
          <section className="section" style={{ marginTop: "3rem" }}>
            <div className="section-label">Unit economics</div>
            <h2 className="section-heading">what this costs at scale</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="cost-table">
                <thead>
                  <tr>
                    <th>Volume</th>
                    <th>Monthly Minutes</th>
                    <th>Single-Vendor Cost</th>
                    <th>Agora Cost</th>
                    <th>Failure Cost Avoided</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>500 calls/day</td>
                    <td>~55,000</td>
                    <td>~$237/mo</td>
                    <td>~$1,540/mo</td>
                    <td className="green-cell">~$25,500/mo</td>
                  </tr>
                  <tr>
                    <td>2,500 calls/day</td>
                    <td>~275,000</td>
                    <td>~$1,183/mo</td>
                    <td>~$6,050/mo</td>
                    <td className="green-cell">~$127,500/mo</td>
                  </tr>
                  <tr>
                    <td>10,000 calls/day</td>
                    <td>~1,100,000</td>
                    <td>~$4,730/mo</td>
                    <td>~$24,200/mo</td>
                    <td className="green-cell">~$510,000/mo</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="footnote">
              Assumptions: 5 min avg call × 22 working days/mo. Single-vendor = $0.0043/min (Deepgram).
              Agora = $0.028/min (Starter) for 500/day, $0.022/min (Growth) for 2,500 and 10,000/day.
              Failure rate: 3.4% of calls. Cost per failed transcript: $50.
            </p>
            <p className="bridge">
              for a contact center running 10,000 calls/day at 3.4% failure rate, that
              is ~340 calls silently misqualified daily. the Starter delta pays for itself
              on the first compliance audit.
            </p>
          </section>

          <hr className="divider" />

          {/* === 5. CTA === */}
          <section className="section" style={{ marginTop: "3rem" }}>
            <h2 className="cta-heading">want to see it on your audio?</h2>
            <p className="cta-sub">
              send us 10–20 minutes of real audio. we run it through both vendors, show
              you where confidence scores diverge, and tell you exactly how many calls
              would have been silently misqualified.
            </p>
            <p className="cta-micro">
              no integration needed. results in 48 hours. free.
            </p>
            <a
              href="mailto:rachel@caretta.so?subject=Agora trial eval"
              className="cta-btn"
            >
              run a trial eval →
            </a>
          </section>

          <hr className="divider" />

          {/* === 6. FAQ === */}
          <section className="section" style={{ marginTop: "3rem" }}>
            <div className="section-label">FAQ</div>
            <div className="faq-item">
              <button
                className="faq-q"
                onClick={() => setOpenFaq(openFaq === 0 ? null : 0)}
              >
                why not just use both vendors myself?
                <span
                  className="faq-chevron"
                  style={{ transform: openFaq === 0 ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▸
                </span>
              </button>
              {openFaq === 0 && (
                <p className="faq-a">
                  you can, but the routing logic and calibration decisions are the product.
                  took months to validate across accent groups — which vendor handles
                  detection, which handles transcription, where to set confidence thresholds,
                  and how to recalibrate when vendor models update.
                </p>
              )}
            </div>
            <div className="faq-item">
              <button
                className="faq-q"
                onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}
              >
                what is the latency hit?
                <span
                  className="faq-chevron"
                  style={{ transform: openFaq === 1 ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▸
                </span>
              </button>
              {openFaq === 1 && (
                <p className="faq-a">
                  ~40–80ms. designed for post-call and async pipelines, not real-time
                  streaming.
                </p>
              )}
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
