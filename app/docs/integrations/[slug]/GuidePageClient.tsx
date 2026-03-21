"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { guides } from "../content";
import type { Components } from "react-markdown";

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "2rem", marginBottom: "1rem" }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "2rem", marginBottom: "0.75rem", borderBottom: "1px solid #222", paddingBottom: "0.5rem" }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: "1rem", fontWeight: 700, marginTop: "1.5rem", marginBottom: "0.5rem" }}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p style={{ lineHeight: 1.7, marginBottom: "1rem" }}>{children}</p>
  ),
  a: ({ href, children }) => (
    <a href={href} style={{ color: "#999", textDecoration: "underline" }}>{children}</a>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: "1.5rem", marginBottom: "1rem", lineHeight: 1.7 }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: "1.5rem", marginBottom: "1rem", lineHeight: 1.7 }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: "0.35rem" }}>{children}</li>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code
          style={{
            display: "block",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            lineHeight: 1.6,
            whiteSpace: "pre",
            overflowX: "auto",
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          backgroundColor: "#111",
          border: "1px solid #222",
          padding: "0.1rem 0.35rem",
          borderRadius: 3,
          fontSize: "0.85rem",
          fontFamily: "monospace",
        }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre
      style={{
        backgroundColor: "#111",
        border: "1px solid #222",
        borderRadius: 4,
        padding: "1rem",
        overflowX: "auto",
        marginBottom: "1rem",
        fontFamily: "monospace",
        fontSize: "0.85rem",
        lineHeight: 1.6,
      }}
    >
      {children}
    </pre>
  ),
  hr: () => (
    <hr style={{ border: "none", borderTop: "1px solid #222", margin: "2rem 0" }} />
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: "3px solid #333",
        paddingLeft: "1rem",
        color: "#999",
        margin: "1rem 0",
      }}
    >
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.85rem",
          fontFamily: "monospace",
        }}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      style={{
        textAlign: "left",
        padding: "0.5rem 0.75rem",
        borderBottom: "1px solid #333",
        color: "#999",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      style={{
        padding: "0.5rem 0.75rem",
        borderBottom: "1px solid #1a1a1a",
      }}
    >
      {children}
    </td>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: "#fff" }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ color: "#999" }}>{children}</em>
  ),
};

export default function GuidePageClient({ slug }: { slug: string }) {
  const guide = guides[slug];

  if (!guide) {
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
          <p>Guide not found.</p>
          <Link href="/docs/integrations" style={{ color: "#999" }}>
            ← Back to integrations
          </Link>
        </div>
      </main>
    );
  }

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
        <Link
          href="/docs/integrations"
          style={{
            color: "#666",
            textDecoration: "none",
            fontSize: "0.85rem",
            display: "inline-block",
            marginBottom: "1.5rem",
          }}
        >
          ← All integrations
        </Link>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {guide.content}
        </ReactMarkdown>
      </div>
    </main>
  );
}
