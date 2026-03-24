"use client";

import Link from "next/link";
import s from "./page.module.css";

const PLATFORMS = [
  {
    name: "Zoom",
    perSpeaker: "✅ Per-participant M4A files via API",
    quality: "High (AAC, per-participant)",
    diarization: "Native (per-channel)",
    complexity: "Medium",
    signal: "full" as const,
  },
  {
    name: "Twilio",
    perSpeaker: "✅ Native dual-channel recording",
    quality: "Medium (8kHz PCMU, stereo)",
    diarization: "Native (per-channel)",
    complexity: "Low",
    signal: "full" as const,
  },
  {
    name: "Aircall",
    perSpeaker: "❌ Single mixed file only",
    quality: "Low (8kHz mono MP3)",
    diarization: "Derived (AI must infer)",
    complexity: "Low",
    signal: "partial" as const,
  },
];

const DEEP_DIVES = [
  {
    title: "Zoom Cloud Recording",
    points: [
      "Per-participant audio files via participant_audio_files API",
      "Separate M4A per speaker → merged into stereo for analysis",
      'Requires account-level setting: "Record a separate audio file of each participant"',
    ],
    result:
      "Clean channel separation, exact rep isolation, highest confidence transcription",
  },
  {
    title: "Twilio Programmable Voice",
    points: [
      "Native dual-channel recording (default for new accounts)",
      "Single stereo WAV: Channel 1 = rep, Channel 2 = customer",
      "No post-processing merge needed — submit directly",
    ],
    result:
      "Clean channel separation, simple integration, PSTN-quality audio",
  },
  {
    title: "Aircall",
    points: [
      "API returns single mono MP3 per call",
      "Both speakers mixed into one track at 8kHz",
      "AI must run diarization on mixed signal to separate speakers",
    ],
    result:
      "Workable transcription, lower attribution confidence, no clean rep isolation",
  },
];

export default function PlatformsPage() {
  return (
    <div className={s.page}>
      <div className={s.container}>
        {/* Hero */}
        <h1 className={s.h1}>Platform Compatibility</h1>
        <p className={s.subtitle}>
          Not all call platforms give AI the same signal. Here&apos;s what each
          one actually exposes.
        </p>

        {/* Compatibility Table */}
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Per-Speaker Audio</th>
                <th>Audio Quality</th>
                <th>Diarization Signal</th>
                <th>Integration Complexity</th>
                <th>Agora Signal Level</th>
              </tr>
            </thead>
            <tbody>
              {PLATFORMS.map((p) => (
                <tr key={p.name}>
                  <td className={s.platformName}>{p.name}</td>
                  <td>{p.perSpeaker}</td>
                  <td>{p.quality}</td>
                  <td>{p.diarization}</td>
                  <td>{p.complexity}</td>
                  <td
                    className={
                      p.signal === "full" ? s.signalFull : s.signalPartial
                    }
                  >
                    {p.signal === "full" ? "Full Signal" : "Partial Signal"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Deep Dives */}
        <section className={s.deepDives}>
          <h2 className={s.h2}>Platform Deep Dives</h2>
          <div className={s.cardGrid}>
            {DEEP_DIVES.map((d) => (
              <div key={d.title} className={s.card}>
                <h3 className={s.cardTitle}>{d.title}</h3>
                <ul>
                  {d.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <div className={s.cardResult}>→ {d.result}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Why This Matters */}
        <section className={s.whySection}>
          <h2 className={s.h2}>Why This Matters</h2>
          <p className={s.whyText}>
            Speaker attribution accuracy depends on audio architecture, not just
            the AI model. When each speaker is on their own audio channel,
            confidence scores are structurally higher — the AI isn&apos;t
            guessing who said what. When both voices are mixed into a single
            track, every attribution is an inference.
          </p>
        </section>

        {/* CTA */}
        <section className={s.cta}>
          <h2 className={s.ctaHeading}>See the difference on your calls</h2>
          <p className={s.ctaText}>
            Run an Agora eval on your actual call recordings. We&apos;ll show
            you exactly what your platform gives us to work with.
          </p>
          <Link href="/eval-report" className={s.ctaButton}>
            Start Free Eval →
          </Link>
        </section>
      </div>
    </div>
  );
}
