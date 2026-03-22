import Link from "next/link";
import { notFound } from "next/navigation";
import artifacts from "../../data/artifacts.json";

export function generateStaticParams() {
  return artifacts.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artifact = artifacts.find((a) => a.slug === slug);
  return { title: artifact ? `${artifact.name} | Agora` : "Artifact | Agora" };
}

const mono =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";

export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artifact = artifacts.find((a) => a.slug === slug);
  if (!artifact) return notFound();

  const specs = artifact.datasetSpecs as Record<string, string>;

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "6rem 2rem 4rem",
        fontFamily: mono,
        color: "#e5e5e5",
      }}
    >
      <Link
        href="/artifacts"
        style={{
          color: "#a3a3a3",
          textDecoration: "none",
          fontSize: "0.8rem",
          display: "inline-block",
          marginBottom: "1.5rem",
        }}
      >
        &larr; Back to Artifact Registry
      </Link>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            {artifact.name}
          </h1>
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
        </div>
        <p style={{ color: "#888", fontSize: "0.8rem", marginTop: "0.5rem" }}>
          {artifact.author} &middot; Published {artifact.published}
        </p>
      </div>

      {/* Description */}
      <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "#a3a3a3", marginBottom: "2rem" }}>
        {artifact.description}
      </p>

      {/* Key Finding */}
      <div
        style={{
          borderLeft: "3px solid #22c55e",
          background: "rgba(34,197,94,0.05)",
          padding: "1.25rem 1.5rem",
          marginBottom: "2.5rem",
          borderRadius: "0 4px 4px 0",
        }}
      >
        <p style={{ fontSize: "0.75rem", color: "#888", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Key Finding
        </p>
        <p style={{ color: "#22c55e", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>
          {artifact.keyFinding}
        </p>
      </div>

      {/* Degradation Results */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
        Degradation Results
      </h2>
      <div style={{ overflowX: "auto", marginBottom: "2.5rem" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #222",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr style={{ background: "#111" }}>
              <th style={{ textAlign: "left", padding: "0.75rem 1rem", borderBottom: "1px solid #222" }}>
                Temporal Offset
              </th>
              <th style={{ textAlign: "right", padding: "0.75rem 1rem", borderBottom: "1px solid #222" }}>
                Accuracy (%)
              </th>
              <th style={{ textAlign: "right", padding: "0.75rem 1rem", borderBottom: "1px solid #222" }}>
                Delta
              </th>
            </tr>
          </thead>
          <tbody>
            {artifact.degradationResults.map((row) => (
              <tr key={row.label} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "0.75rem 1rem" }}>{row.label}</td>
                <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                  {row.accuracy.toFixed(2)}
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    color: row.delta === null ? "#888" : "#ef4444",
                  }}
                >
                  {row.delta === null ? "—" : `${row.delta.toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dataset Specs */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
        Dataset Specifications
      </h2>
      <dl style={{ marginBottom: "2.5rem" }}>
        {Object.entries(specs).map(([key, value]) => (
          <div
            key={key}
            style={{
              display: "flex",
              gap: "1rem",
              padding: "0.5rem 0",
              borderBottom: "1px solid #222",
              fontSize: "0.85rem",
            }}
          >
            <dt style={{ color: "#888", minWidth: 160, flexShrink: 0 }}>
              {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
            </dt>
            <dd style={{ margin: 0, color: "#a3a3a3" }}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* Intended Use */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
        Intended Use
      </h2>
      <ul style={{ paddingLeft: "1.25rem", marginBottom: "2.5rem", fontSize: "0.85rem", lineHeight: 1.7, color: "#a3a3a3" }}>
        {artifact.intendedUse.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {/* Limitations */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
        Limitations
      </h2>
      <ul style={{ paddingLeft: "1.25rem", marginBottom: "2.5rem", fontSize: "0.85rem", lineHeight: 1.7, color: "#888" }}>
        {artifact.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {/* Access */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
        Access
      </h2>
      <div
        style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 8,
          padding: "1.25rem 1.5rem",
          fontSize: "0.85rem",
        }}
      >
        <p style={{ margin: "0 0 0.5rem", color: "#a3a3a3" }}>
          <span style={{ color: "#888" }}>Type:</span> {artifact.access.type}
        </p>
        <p style={{ margin: "0 0 0.5rem", color: "#a3a3a3" }}>
          <span style={{ color: "#888" }}>HuggingFace:</span>{" "}
          {artifact.access.huggingface}
        </p>
        <p style={{ margin: 0, color: "#888", fontStyle: "italic" }}>
          {artifact.access.note}
        </p>
      </div>
    </main>
  );
}
