"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { useState } from "react";

// F1 scores extracted from FiNER-139 temporal drift analysis (2026-03-22/23)
const PERIODS = ["2015–18", "2019", "2020", "2021", "2022+"];

const CATEGORIES: Record<
  string,
  { tfidf: number[]; finbert: number[]; color: string; status: string }
> = {
  "SHARES/COUNT": {
    tfidf: [0.505, 0.492, 0.511, 0.055, 0.113],
    finbert: [0.68, 0.707, 0.622, 0.414, 0.0],
    color: "#ef4444",
    status: "collapse",
  },
  DURATION: {
    tfidf: [0.525, 0.552, 0.45, 0.231, 0.231],
    finbert: [0.167, 0.0, 0.077, 0.137, 0.036],
    color: "#f97316",
    status: "collapse",
  },
  MONETARY: {
    tfidf: [0.684, 0.707, 0.666, 0.657, 0.673],
    finbert: [0.606, 0.609, 0.566, 0.466, 0.561],
    color: "#22c55e",
    status: "stable",
  },
  PERCENTAGE: {
    tfidf: [0.611, 0.633, 0.637, 0.656, 0.639],
    finbert: [0.47, 0.482, 0.497, 0.509, 0.608],
    color: "#22c55e",
    status: "stable",
  },
  PRICE: {
    tfidf: [0.656, 0.637, 0.663, 0.661, 0.678],
    finbert: [0.5, 0.0, 0.0, 0.135, 0.18],
    color: "#a3a3a3",
    status: "mixed",
  },
};

// Alert definitions: Q4-2021 and Q4-2022
const ALERTS = [
  { period: "2021", label: "Q4-2021", text: "Drift detected — retrain recommended" },
  { period: "2022+", label: "Q4-2022", text: "Drift detected — retrain recommended" },
];

function buildChartData(category: string) {
  const cat = CATEGORIES[category];
  return PERIODS.map((p, i) => ({
    period: p,
    "TF-IDF": cat.tfidf[i],
    FinBERT: cat.finbert[i],
  }));
}

function AlertDot({
  cx,
  cy,
  alertText,
}: {
  cx: number;
  cy: number;
  alertText: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#0a0a0a" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={10} fill="none" stroke="#ef4444" strokeWidth={1} opacity={0.5} />
    </g>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const alert = ALERTS.find((a) => a.period === label);
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 6,
        padding: "0.75rem 1rem",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ color: "#e5e5e5", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.value.toFixed(3)}
        </div>
      ))}
      {alert && (
        <div
          style={{
            marginTop: 6,
            padding: "4px 8px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid #ef4444",
            borderRadius: 4,
            color: "#ef4444",
            fontWeight: 600,
            fontSize: "0.75rem",
          }}
        >
          {alert.text}
        </div>
      )}
    </div>
  );
}

function CategoryChart({
  category,
  large,
}: {
  category: string;
  large?: boolean;
}) {
  const data = buildChartData(category);
  const cat = CATEGORIES[category];
  const h = large ? 400 : 260;

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 8,
        padding: "1.25rem 1.25rem 0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: cat.color,
          }}
        />
        <span style={{ fontWeight: 600, color: "#e5e5e5", fontSize: "0.9rem" }}>
          {category}
        </span>
        {cat.status === "collapse" && (
          <span
            style={{
              fontSize: "0.65rem",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              padding: "2px 8px",
              borderRadius: 4,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Drift detected
          </span>
        )}
        {cat.status === "stable" && (
          <span
            style={{
              fontSize: "0.65rem",
              background: "rgba(34, 197, 94, 0.1)",
              color: "#22c55e",
              padding: "2px 8px",
              borderRadius: 4,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Stable
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={h}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis
            dataKey="period"
            tick={{ fill: "#666", fontSize: 12 }}
            stroke="#333"
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
            tick={{ fill: "#666", fontSize: 12 }}
            stroke="#333"
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "0.75rem", color: "#999" }}
          />
          {/* Alert reference lines */}
          <ReferenceLine
            x="2021"
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
          />
          <ReferenceLine
            x="2022+"
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
          />
          <Line
            type="monotone"
            dataKey="TF-IDF"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 3, fill: "#60a5fa" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="FinBERT"
            stroke="#c084fc"
            strokeWidth={2}
            dot={{ r: 3, fill: "#c084fc" }}
            activeDot={{ r: 5 }}
          />
          {/* Red alert markers at Q4-2021 and Q4-2022 for TF-IDF */}
          {cat.status === "collapse" && (
            <>
              <ReferenceDot
                x="2021"
                y={cat.tfidf[3]}
                r={6}
                fill="#ef4444"
                stroke="#0a0a0a"
                strokeWidth={2}
              />
              <ReferenceDot
                x="2022+"
                y={cat.tfidf[4]}
                r={6}
                fill="#ef4444"
                stroke="#0a0a0a"
                strokeWidth={2}
              />
              <ReferenceDot
                x="2021"
                y={cat.finbert[3]}
                r={6}
                fill="#ef4444"
                stroke="#0a0a0a"
                strokeWidth={2}
              />
              <ReferenceDot
                x="2022+"
                y={cat.finbert[4]}
                r={6}
                fill="#ef4444"
                stroke="#0a0a0a"
                strokeWidth={2}
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DemoPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 2rem 4rem" }}>
      {/* Hero */}
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          color: "#e5e5e5",
          letterSpacing: "-0.03em",
          margin: "0 0 0.75rem",
        }}
      >
        Drift Detection Demo
      </h1>
      <p style={{ color: "#a3a3a3", fontSize: "0.95rem", lineHeight: 1.7, margin: "0 0 1.5rem", maxWidth: 700 }}>
        FiNER-139 entity recognition across temporal gaps. Two frozen baselines — TF-IDF and
        FinBERT — evaluated on SEC filings from 2015 through 2024. Red markers indicate where
        Agora&apos;s drift detection would have fired an alert.
      </p>

      {/* Alert callout */}
      <div
        style={{
          borderLeft: "3px solid #ef4444",
          background: "rgba(239, 68, 68, 0.05)",
          padding: "1rem 1.25rem",
          borderRadius: "0 6px 6px 0",
          marginBottom: "2.5rem",
          maxWidth: 700,
        }}
      >
        <div
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#ef4444",
            fontWeight: 600,
            marginBottom: "0.5rem",
          }}
        >
          Key Finding
        </div>
        <p style={{ color: "#c4c4c4", fontSize: "0.85rem", lineHeight: 1.65, margin: 0 }}>
          SHARES/COUNT entities collapse from F1&nbsp;=&nbsp;0.68 to F1&nbsp;=&nbsp;0.00 at the 4-year
          gap. Agora would have fired a CRITICAL alert at Q4-2021 — 12&nbsp;months before complete
          model collapse — with a recommendation to retrain on post-SPAC era filings.
        </p>
      </div>

      {/* Category selector */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            background: selected === null ? "#e5e5e5" : "#1a1a1a",
            color: selected === null ? "#0a0a0a" : "#999",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          All Categories
        </button>
        {Object.keys(CATEGORIES).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelected(cat)}
            style={{
              background: selected === cat ? "#e5e5e5" : "#1a1a1a",
              color: selected === cat ? "#0a0a0a" : "#999",
              border: `1px solid ${selected === cat ? "#e5e5e5" : "#333"}`,
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Charts */}
      {selected ? (
        <CategoryChart category={selected} large />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
            gap: "1rem",
          }}
        >
          {Object.keys(CATEGORIES).map((cat) => (
            <CategoryChart key={cat} category={cat} />
          ))}
        </div>
      )}

      {/* Legend / methodology */}
      <div
        style={{
          marginTop: "2.5rem",
          padding: "1.25rem 1.5rem",
          background: "#111",
          border: "1px solid #222",
          borderRadius: 8,
          fontSize: "0.8rem",
          color: "#666",
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 600, color: "#999", marginBottom: "0.5rem" }}>
          Methodology
        </div>
        <p style={{ margin: "0 0 0.5rem" }}>
          <strong style={{ color: "#60a5fa" }}>TF-IDF</strong>: 20k features, 1-2 ngrams +
          LogisticRegression per entity category.{" "}
          <strong style={{ color: "#c084fc" }}>FinBERT</strong>: ProsusAI/finbert frozen CLS
          embeddings (768-dim) + LogisticRegression.
        </p>
        <p style={{ margin: "0 0 0.5rem" }}>
          Dataset: <strong style={{ color: "#999" }}>FiNER-139</strong> (nlpaueb/finer-139) — 1M+
          sentences from SEC filings. Train: 2015–2018. Eval splits: ID, 1yr, 2yr, 3yr, 4yr+ gap.
        </p>
        <p style={{ margin: 0 }}>
          Alert thresholds: WARNING at &gt;8% relative drop, ALERT at &gt;10pp absolute or &gt;15%
          relative, CRITICAL at &gt;30pp absolute. Dual method: threshold + CUSUM.
        </p>
      </div>
    </div>
  );
}
