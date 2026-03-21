import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "./content";

export const metadata: Metadata = {
  title: "Integration Guides | Agora",
  description:
    "Step-by-step guides for integrating Agora speaker_locale with Twilio, Genesys, Avaya, and Cisco Webex.",
  openGraph: {
    title: "Integration Guides | Agora",
    description:
      "Step-by-step guides for integrating Agora speaker_locale with Twilio, Genesys, Avaya, and Cisco Webex.",
  },
};

const guideOrder = ["twilio", "genesys", "avaya", "cisco-webex"] as const;

export default function IntegrationsIndex() {
  return (
    <main
      style={{
        backgroundColor: "#0a0a0a",
        color: "#e5e5e5",
        minHeight: "100vh",
        fontFamily: "monospace",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Integration Guides
        </h1>
        <p style={{ color: "#666", marginBottom: "2rem", fontSize: "0.9rem" }}>
          Pass your platform&apos;s detected language to Agora&apos;s{" "}
          <code
            style={{
              backgroundColor: "#111",
              border: "1px solid #222",
              padding: "0.1rem 0.35rem",
              borderRadius: 3,
              fontSize: "0.85rem",
            }}
          >
            speaker_locale
          </code>{" "}
          for precision temperature routing.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {guideOrder.map((slug) => (
            <li
              key={slug}
              style={{
                borderBottom: "1px solid #222",
                padding: "1rem 0",
              }}
            >
              <Link
                href={`/docs/integrations/${slug}`}
                style={{
                  color: "#999",
                  textDecoration: "none",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                }}
              >
                {guides[slug].title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
