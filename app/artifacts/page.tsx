import Link from "next/link";
import artifacts from "../data/artifacts.json";

export const metadata = {
  title: "Artifact Registry | Agora",
};

export default function ArtifactsPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "6rem 2rem 4rem",
        fontFamily:
          "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
        color: "#e5e5e5",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Artifact Registry
      </h1>
      <p style={{ color: "#a3a3a3", fontSize: "0.95rem", marginBottom: "2.5rem" }}>
        Reproducible evaluation artifacts published by Agora and the community.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {artifacts.map((artifact) => (
          <Link
            key={artifact.slug}
            href={`/artifacts/${artifact.slug}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: 8,
                padding: "1.5rem",
                transition: "border-color 0.15s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "0.75rem",
                }}
              >
                <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                  {artifact.name}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    background: "rgba(255,255,255,0.08)",
                    padding: "0.15rem 0.5rem",
                    borderRadius: 4,
                    color: "#a3a3a3",
                  }}
                >
                  v{artifact.version}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    background: "rgba(34,197,94,0.1)",
                    color: "#22c55e",
                    border: "1px solid rgba(34,197,94,0.3)",
                    padding: "0.15rem 0.5rem",
                    borderRadius: 4,
                    marginLeft: "auto",
                  }}
                >
                  {artifact.status}
                </span>
              </div>

              <p
                style={{
                  color: "#a3a3a3",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                  marginBottom: "0.75rem",
                }}
              >
                {artifact.description}
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                {artifact.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "0.7rem",
                      background: "rgba(34,197,94,0.1)",
                      color: "#22c55e",
                      border: "1px solid rgba(34,197,94,0.3)",
                      padding: "0.2rem 0.55rem",
                      borderRadius: 12,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p style={{ color: "#22c55e", fontSize: "0.8rem", fontStyle: "italic", margin: 0 }}>
                {artifact.keyFinding}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
