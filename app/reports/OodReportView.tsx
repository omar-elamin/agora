import type { OodReportData } from "../types/ood-report";

const CSS_VARS = {
  "--agora-dark": "#0f1117",
  "--agora-surface": "#1a1d27",
  "--agora-accent": "#6c63ff",
  "--agora-accent2": "#00d4aa",
  "--text-primary": "#1a1d2e",
  "--text-secondary": "#4a5068",
  "--text-muted": "#7a8099",
  "--border": "#e4e7f0",
  "--bg": "#f7f8fc",
  "--bg-alt": "#eef0f8",
  "--red": "#e53e3e",
  "--orange": "#dd6b20",
  "--yellow": "#d69e2e",
  "--green": "#38a169",
  "--blue": "#3182ce",
} as Record<string, string>;

function v(name: string): string {
  return CSS_VARS[name] ?? name;
}

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  red: { bg: "#fff0f0", color: v("--red") },
  orange: { bg: "#fff5ec", color: v("--orange") },
  yellow: { bg: "#fffce0", color: v("--yellow") },
  green: { bg: "#f0fff4", color: v("--green") },
};

function Badge({ severity, children }: { severity: string; children: React.ReactNode }) {
  const c = BADGE_COLORS[severity] ?? BADGE_COLORS.red;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: "100px",
        fontSize: "12px",
        fontWeight: 700,
        whiteSpace: "nowrap",
        background: c.bg,
        color: c.color,
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: v("--agora-accent"),
        marginBottom: "6px",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "21px",
        fontWeight: 700,
        letterSpacing: "-0.3px",
        color: v("--text-primary"),
        marginBottom: "16px",
      }}
    >
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: "15px",
        fontWeight: 600,
        color: v("--text-primary"),
        marginBottom: "10px",
        marginTop: "24px",
      }}
    >
      {children}
    </h3>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        margin: "16px 0",
      }}
    >
      {children}
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "white",
  fontSize: "13.5px",
};

const theadStyle: React.CSSProperties = {
  background: v("--agora-dark"),
  color: "white",
};

const thStyle: React.CSSProperties = {
  padding: "13px 16px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.8px",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

function tdStyle(opts?: { bold?: boolean; num?: boolean; muted?: boolean }): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderBottom: `1px solid ${v("--border")}`,
    verticalAlign: "middle",
    fontWeight: opts?.bold ? 600 : undefined,
    fontVariantNumeric: opts?.num ? "tabular-nums" : undefined,
    fontFamily: opts?.num ? "'JetBrains Mono', 'Fira Code', monospace" : undefined,
    fontSize: opts?.num ? "13px" : opts?.muted ? "12px" : undefined,
    color: opts?.muted ? v("--text-muted") : undefined,
  };
}

function rowBg(i: number): React.CSSProperties {
  return i % 2 === 1 ? { background: v("--bg-alt") } : {};
}

function MetricCard({
  color,
  label,
  value,
  sub,
  delta,
}: {
  color: string;
  label: string;
  value: string;
  sub: string;
  delta?: { direction: "down" | "up"; text: string };
}) {
  const colorMap: Record<string, string> = {
    blue: v("--blue"),
    red: v("--red"),
    orange: v("--orange"),
    purple: v("--agora-accent"),
    teal: v("--agora-accent2"),
    green: v("--green"),
  };
  const c = colorMap[color] ?? v("--blue");
  return (
    <div
      style={{
        background: "white",
        borderRadius: "8px",
        padding: "20px 20px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        borderTop: `3px solid ${c}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.8px",
          textTransform: "uppercase",
          color: v("--text-muted"),
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "30px",
          fontWeight: 800,
          letterSpacing: "-1px",
          lineHeight: 1,
          marginBottom: "6px",
          color: c,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "12px", color: v("--text-muted") }}>{sub}</div>
      {delta && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "12px",
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: "100px",
            marginTop: "8px",
            background: delta.direction === "down" ? "#fff0f0" : "#f0fff4",
            color: delta.direction === "down" ? v("--red") : v("--green"),
          }}
        >
          {delta.direction === "down" ? "\u2193" : "\u2191"} {delta.text}
        </div>
      )}
    </div>
  );
}

function Callout({
  variant,
  icon,
  children,
  style: extraStyle,
}: {
  variant: "info" | "warning" | "success" | "danger";
  icon: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const borderColors: Record<string, string> = {
    info: v("--agora-accent"),
    warning: v("--yellow"),
    success: v("--green"),
    danger: v("--red"),
  };
  const bgColors: Record<string, string> = {
    info: "#eef2ff",
    warning: "#fffbea",
    success: "#f0fff4",
    danger: "#fff5f5",
  };
  return (
    <div
      style={{
        padding: "14px 18px",
        borderRadius: "8px",
        margin: "14px 0",
        fontSize: "13.5px",
        lineHeight: 1.65,
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        background: bgColors[variant],
        borderLeft: `3px solid ${borderColors[variant]}`,
        ...extraStyle,
      }}
    >
      <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function ChartPlaceholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "8px",
        border: `2px dashed ${v("--border")}`,
        minHeight: "260px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        margin: "16px 0",
        color: v("--text-muted"),
        textAlign: "center",
        padding: "24px",
      }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.2 }}>
        <path
          d="M6 38 L14 26 L22 30 L32 14 L42 10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 38 L14 32 L22 34 L32 22 L42 18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 3"
        />
      </svg>
      <div style={{ fontSize: "14px", fontWeight: 600, color: v("--text-secondary") }}>{title}</div>
      <div style={{ fontSize: "12px", color: v("--text-muted"), maxWidth: "360px" }}>{hint}</div>
    </div>
  );
}

function ChartCaption({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "12.5px",
        color: v("--text-secondary"),
        lineHeight: 1.6,
        padding: "10px 14px",
        background: v("--bg-alt"),
        borderRadius: "0 0 8px 8px",
        borderLeft: `3px solid ${v("--border")}`,
        marginTop: "-8px",
        marginBottom: "16px",
      }}
    >
      {children}
    </div>
  );
}

export default function OodReportView({ data }: { data: OodReportData }) {
  const d = data;

  return (
    <div
      style={{
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        background: v("--bg"),
        color: v("--text-primary"),
        lineHeight: 1.65,
        WebkitFontSmoothing: "antialiased",
        minHeight: "100vh",
      }}
    >
      {/* -- Header -- */}
      <header style={{ background: v("--agora-dark"), color: "white", marginBottom: "40px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "40px 24px 36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                background: `linear-gradient(135deg, ${v("--agora-accent")}, ${v("--agora-accent2")})`,
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "16px",
                color: "white",
                letterSpacing: "-0.5px",
                flexShrink: 0,
              }}
            >
              A
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.3px", color: "white" }}>
              agora<span style={{ color: v("--agora-accent2") }}>.</span>
            </div>
          </div>
          <div
            style={{
              width: "40px",
              height: "2px",
              background: v("--agora-accent"),
              marginBottom: "20px",
              borderRadius: "2px",
            }}
          />
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: v("--agora-accent2"),
              marginBottom: "10px",
            }}
          >
            Eval Report
          </div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.5px",
              color: "white",
              marginBottom: "8px",
            }}
          >
            {d.reportTitle}
          </h1>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.55)", marginBottom: "28px" }}>
            {d.evalType} &middot; {d.customerName}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {[
              `Dataset: ${d.dataset.name}`,
              `Run date: ${d.runDate}`,
              "Prepared by Agora",
            ].map((text) => (
              <span
                key={text}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "100px",
                  padding: "5px 14px",
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.75)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: v("--agora-accent2"),
                    flexShrink: 0,
                  }}
                />
                {text}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* -- Main Content -- */}
      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "0 24px 64px" }}>
        {/* Executive Summary */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>TL;DR</SectionLabel>
          <SectionTitle>Executive Summary</SectionTitle>
          <div
            style={{
              background: "white",
              borderLeft: `4px solid ${v("--agora-accent")}`,
              borderRadius: "0 8px 8px 0",
              padding: "22px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              fontSize: "14.5px",
              lineHeight: 1.75,
              color: v("--text-primary"),
            }}
          >
            {d.execSummary}
          </div>
        </section>

        {/* Headline Metric Cards */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>Key Numbers</SectionLabel>
          <SectionTitle>Headline Results</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              margin: "24px 0",
            }}
          >
            <MetricCard
              color="blue"
              label={`${d.modelB.name} \u00b7 Train Acc`}
              value={d.modelB.trainAcc}
              sub="In-distribution baseline"
            />
            <MetricCard
              color="red"
              label={`${d.modelB.name} \u00b7 OOD Acc`}
              value={d.modelB.oodAcc}
              sub="Post-cutoff data"
              delta={{ direction: "down", text: `${d.modelB.delta} vs. train` }}
            />
            <MetricCard
              color="orange"
              label={`${d.modelA.name} \u00b7 OOD Acc`}
              value={d.modelA.oodAcc}
              sub="Post-cutoff data"
              delta={{ direction: "down", text: `${d.modelA.delta} vs. train` }}
            />
            <MetricCard
              color="purple"
              label="Best Model CII"
              value={d.modelB.cii}
              sub="Confidence Inflation Index"
            />
            <MetricCard
              color="teal"
              label="Best Model Macro F1 (OOD)"
              value={d.modelB.f1Ood}
              sub="Balanced category accuracy"
            />
            <MetricCard
              color="green"
              label="OOD Test Set Size"
              value={d.oodTestSize}
              sub="Records post-cutoff"
            />
          </div>
        </section>

        {/* What We Tested */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>Methodology</SectionLabel>
          <SectionTitle>What We Tested and Why</SectionTitle>

          <Callout variant="info" icon="\ud83d\udcd0">
            <strong>Eval type: Temporal Out-of-Distribution (OOD)</strong>
            <br />
            Standard benchmarks test in-distribution performance. Temporal OOD answers the question
            that actually matters in production:{" "}
            <em>what happens when your data looks different from what the model was trained on?</em>
          </Callout>

          <SubTitle>The Dataset</SubTitle>
          <TableWrap>
            <table style={tableStyle}>
              <thead style={theadStyle}>
                <tr>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Value</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Dataset", d.dataset.name],
                  ["Source", d.dataset.source],
                  ["License", d.dataset.license],
                  ["Total records", d.dataset.totalRecords],
                  ["Date range", d.dataset.dateRange],
                  ["Task", d.dataset.task],
                  ["Input format", d.dataset.inputFormat],
                ].map(([field, val], i) => (
                  <tr key={field} style={rowBg(i)}>
                    <td style={tdStyle({ bold: true })}>{field}</td>
                    <td style={tdStyle({ num: field === "Total records" })}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          <SubTitle>Experimental Setup</SubTitle>
          <TableWrap>
            <table style={tableStyle}>
              <thead style={theadStyle}>
                <tr>
                  <th style={thStyle}>Split</th>
                  <th style={thStyle}>Date Range</th>
                  <th style={thStyle}>Records</th>
                  <th style={thStyle}>Role</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle({ bold: true })}>Train</td>
                  <td style={tdStyle()}>{d.splits.trainDates}</td>
                  <td style={tdStyle({ num: true })}>{d.splits.trainSize}</td>
                  <td style={tdStyle()}>Model training</td>
                </tr>
                <tr style={rowBg(1)}>
                  <td style={tdStyle({ bold: true })}>Dev</td>
                  <td style={tdStyle()}>{d.splits.devDates}</td>
                  <td style={tdStyle({ num: true })}>{d.splits.devSize}</td>
                  <td style={tdStyle()}>Tuning / early stopping</td>
                </tr>
                <tr>
                  <td style={tdStyle({ bold: true })}>OOD Test</td>
                  <td style={tdStyle()}>{d.splits.oodDates}</td>
                  <td style={tdStyle({ num: true })}>{d.splits.oodSize}</td>
                  <td style={tdStyle()}>Out-of-distribution evaluation</td>
                </tr>
              </tbody>
            </table>
          </TableWrap>
          <p style={{ fontSize: "12.5px", color: v("--text-muted"), marginTop: "8px" }}>
            Any accuracy drop on the OOD test set is attributable to temporal distribution shift —
            not memorization, overfitting, or luck.
          </p>
        </section>

        {/* Models Evaluated */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>Scope</SectionLabel>
          <SectionTitle>Models Evaluated</SectionTitle>
          <TableWrap>
            <table style={tableStyle}>
              <thead style={theadStyle}>
                <tr>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Training Time</th>
                  <th style={thStyle}>Hardware</th>
                </tr>
              </thead>
              <tbody>
                {[d.modelA, d.modelB].map((m, i) => (
                  <tr key={m.name} style={rowBg(i)}>
                    <td style={tdStyle({ bold: true })}>{m.name}</td>
                    <td style={tdStyle()}>{m.description}</td>
                    <td style={tdStyle()}>{m.trainTime}</td>
                    <td style={tdStyle()}>{m.hardware}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Callout variant="info" icon="\ud83d\udca1" style={{ marginTop: "14px" }}>
            <strong>Why both?</strong> The baseline tells us how much degradation is a pure
            vocabulary problem. The transformer tells us whether semantic understanding helps. The gap
            between them is instructive.
          </Callout>
        </section>

        {/* Results */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>Results</SectionLabel>
          <SectionTitle>Results</SectionTitle>

          <SubTitle>3.1 — Headline Numbers</SubTitle>
          <TableWrap>
            <table style={tableStyle}>
              <thead style={theadStyle}>
                <tr>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>Train Acc</th>
                  <th style={thStyle}>OOD Acc</th>
                  <th style={thStyle}>Accuracy Drop (\u0394)</th>
                  <th style={thStyle}>Macro F1 (Train)</th>
                  <th style={thStyle}>Macro F1 (OOD)</th>
                </tr>
              </thead>
              <tbody>
                {[d.modelA, d.modelB].map((m, i) => (
                  <tr key={m.name} style={rowBg(i)}>
                    <td style={tdStyle({ bold: true })}>{m.name}</td>
                    <td style={tdStyle({ num: true })}>{m.trainAcc}</td>
                    <td style={tdStyle({ num: true })}>{m.oodAcc}</td>
                    <td>
                      <Badge severity={i === 0 ? "red" : "orange"}>{m.delta}</Badge>
                    </td>
                    <td style={tdStyle({ num: true })}>{m.f1Train}</td>
                    <td style={tdStyle({ num: true })}>{m.f1Ood}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <p
            style={{
              fontSize: "12.5px",
              color: v("--text-secondary"),
              margin: "10px 0 24px",
            }}
          >
            <strong>Reading this table:</strong> The &quot;Accuracy Drop&quot; column is the core
            signal. Each point represents one correct prediction in ten lost purely because the data
            is newer than the training window.
          </p>

          <SubTitle>3.2 — Accuracy Over Time (Temporal Drift Curve)</SubTitle>
          <ChartPlaceholder
            title="Model Accuracy Over Time on Post-Cutoff Data"
            hint={`Line chart: blue = ${d.modelB.name}, orange dashed = ${d.modelA.name}. X = month post-cutoff, Y = top-1 accuracy.`}
          />
          <ChartCaption>{d.driftCurveCaption}</ChartCaption>

          <SubTitle>3.3 — Per-Category Accuracy Breakdown</SubTitle>
          <TableWrap>
            <table style={tableStyle}>
              <thead style={theadStyle}>
                <tr>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Train Acc</th>
                  <th style={thStyle}>OOD Acc</th>
                  <th style={thStyle}>{"\u0394"}</th>
                  <th style={thStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {d.categories.map((cat, i) => (
                  <tr key={cat.name} style={rowBg(i)}>
                    <td style={tdStyle({ bold: true })}>{cat.name}</td>
                    <td style={tdStyle({ num: true })}>{cat.trainAcc}</td>
                    <td style={tdStyle({ num: true })}>{cat.oodAcc}</td>
                    <td>
                      <Badge severity={cat.severity}>{cat.delta}</Badge>
                    </td>
                    <td style={tdStyle({ muted: true })}>{cat.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          <ChartPlaceholder
            title="Accuracy Drop by Category"
            hint="Horizontal bar chart sorted by \u0394 (worst at top). Color: red > \u221210 pp, orange \u22125 to \u221210 pp, yellow \u22121 to \u22125 pp, green \u2248 0."
          />
          <ChartCaption>{d.categoryChartCaption}</ChartCaption>

          <SubTitle>3.4 — Confidence Behavior Under Shift</SubTitle>
          <TableWrap>
            <table style={tableStyle}>
              <thead style={theadStyle}>
                <tr>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>Avg Conf (Train)</th>
                  <th style={thStyle}>Avg Conf (OOD)</th>
                  <th style={thStyle}>Avg Acc (OOD)</th>
                  <th style={thStyle}>CII</th>
                </tr>
              </thead>
              <tbody>
                {[d.modelA, d.modelB].map((m, i) => (
                  <tr key={m.name} style={rowBg(i)}>
                    <td style={tdStyle({ bold: true })}>{m.name}</td>
                    <td style={tdStyle({ num: true })}>{m.confTrain}</td>
                    <td style={tdStyle({ num: true })}>{m.confOod}</td>
                    <td style={tdStyle({ num: true })}>{m.oodAcc}</td>
                    <td>
                      <Badge severity={i === 0 ? "red" : "green"}>
                        {m.cii} {i === 0 ? "\u26a0\ufe0f" : "\u2713"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Callout variant="warning" icon="\u26a0\ufe0f" style={{ marginTop: "12px" }}>
            <strong>Reading CII:</strong> CII = 1.0 means the model adjusts confidence
            proportionally to its accuracy drop (healthy). CII &gt; 1.2 means it stays overconfident
            while getting worse — a silent, dangerous failure mode. CII &lt; 1.0 is conservative and
            typically safer.
          </Callout>
        </section>

        {/* Deployment Implications */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>So What</SectionLabel>
          <SectionTitle>What This Means for Your Deployment</SectionTitle>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              margin: "16px 0",
            }}
          >
            <Callout
              variant="success"
              icon="\u2705"
              style={{ flexDirection: "column", gap: "8px" }}
            >
              <strong>Low Drift Risk</strong>
              <div style={{ fontSize: "13px" }}>
                If your production data is within a tightly scoped, stable domain, both models are
                viable. Optimize for in-distribution accuracy and inference cost.
              </div>
            </Callout>
            <Callout
              variant="warning"
              icon="\u26a0\ufe0f"
              style={{ flexDirection: "column", gap: "8px" }}
            >
              <strong>High Drift Risk</strong>
              <div style={{ fontSize: "13px" }}>
                If your data evolves over time, the OOD gap is the number that matters.{" "}
                {d.modelB.name} is the more resilient choice. Plan for recalibration windows every
                6\u201312 months.
              </div>
            </Callout>
          </div>

          <SubTitle>The Monitoring Question</SubTitle>
          <p
            style={{
              fontSize: "13.5px",
              color: v("--text-secondary"),
              lineHeight: 1.7,
              marginBottom: "12px",
            }}
          >
            OOD degradation is only a problem if you can&apos;t see it. Models with well-calibrated
            confidence scores are easier to monitor.
          </p>
          <TableWrap>
            <table style={tableStyle}>
              <thead style={theadStyle}>
                <tr>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>Monitoring Approach</th>
                  <th style={thStyle}>Estimated Overhead</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle({ bold: true })}>{d.modelB.name}</td>
                  <td style={tdStyle()}>Standard confidence threshold monitoring</td>
                  <td>
                    <Badge severity="green">Standard ops</Badge>
                  </td>
                </tr>
                <tr style={rowBg(1)}>
                  <td style={tdStyle({ bold: true })}>{d.modelA.name}</td>
                  <td style={tdStyle()}>
                    5\u201310% random sample ground-truth auditing required (CII too high to trust
                    confidence scores)
                  </td>
                  <td>
                    <Badge severity="orange">+Auditing overhead</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </TableWrap>
        </section>

        {/* Limitations */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>Transparency</SectionLabel>
          <SectionTitle>Limitations</SectionTitle>
          <p
            style={{
              fontSize: "13.5px",
              color: v("--text-secondary"),
              marginBottom: "16px",
            }}
          >
            These limitations are not disclaimers — they&apos;re the context you need to interpret
            these results correctly.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              marginTop: "16px",
            }}
          >
            {[
              { icon: "\ud83d\udcca", title: "Test Set Size", text: d.limitations.testSetSize },
              { icon: "\ud83d\udcc4", title: "Text Format", text: d.limitations.textFormat },
              { icon: "\ud83c\udf10", title: "Source Bias", text: d.limitations.sourceBias },
              { icon: "\ud83c\udff7\ufe0f", title: "Label Consistency", text: d.limitations.labelConsistency },
              { icon: "\ud83d\udcdc", title: "Attribution", text: d.limitations.attribution },
              {
                icon: "\ud83d\udd32",
                title: "Out of Scope",
                text: "This eval measures temporal OOD robustness only. It does not cover calibration, adversarial robustness, latency, cost, safety, or fairness.",
              },
            ].map((lim) => (
              <div
                key={lim.title}
                style={{
                  background: "white",
                  borderRadius: "8px",
                  padding: "18px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  borderTop: `2px solid ${v("--border")}`,
                }}
              >
                <h4
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: v("--text-primary"),
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {lim.icon} {lim.title}
                </h4>
                <p style={{ fontSize: "12.5px", color: v("--text-secondary"), lineHeight: 1.65 }}>
                  {lim.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Key Metrics Reference */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>Reference</SectionLabel>
          <SectionTitle>How to Read Agora Reports</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              margin: "16px 0",
            }}
          >
            {[
              {
                title: "Accuracy Drop (\u0394)",
                desc: "How much accuracy falls on post-training data.",
                good: "\u2713 < 5 pp",
                warn: "\u26a0 > 10 pp",
              },
              {
                title: "Macro F1 ratio (OOD/Train)",
                desc: "Balanced accuracy across categories under shift.",
                good: "\u2713 > 0.90",
                warn: "\u26a0 < 0.80",
              },
              {
                title: "CII \u2014 Confidence Inflation Index",
                desc: "Whether confidence tracks accuracy under shift.",
                good: "\u2713 0.9\u20131.1",
                warn: "\u26a0 > 1.2",
              },
              {
                title: "ECE \u2014 Expected Calibration Error",
                desc: "How well confidence correlates with actual accuracy.",
                good: "\u2713 < 0.05",
                warn: "\u26a0 > 0.10",
              },
            ].map((ref) => (
              <div
                key={ref.title}
                style={{
                  background: "white",
                  borderRadius: "8px",
                  padding: "16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  borderLeft: `3px solid ${v("--agora-accent")}`,
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    color: v("--agora-accent"),
                    marginBottom: "4px",
                  }}
                >
                  {ref.title}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: v("--text-secondary"),
                    marginBottom: "10px",
                  }}
                >
                  {ref.desc}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "100px",
                      background: "#f0fff4",
                      color: v("--green"),
                    }}
                  >
                    {ref.good}
                  </span>
                  <span
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "100px",
                      background: "#fff5f5",
                      color: v("--red"),
                    }}
                  >
                    {ref.warn}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Methodology Notes */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>Methodology</SectionLabel>
          <SectionTitle>Methodology Notes</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              margin: "12px 0",
            }}
          >
            {[
              ["Split cutoff", d.splits.cutoff],
              ["Train size", d.splits.trainSize],
              ["OOD test size", d.splits.oodSize],
              ["TF-IDF features", d.params.tfidfFeatures],
              ["LogReg config", d.params.logReg],
              ["Transformer base", d.params.transformer],
              ["Fine-tune config", d.params.finetune],
              ["Calibration metric", d.params.calibration],
              ["CII formula", "mean(conf_OOD) / mean(conf_ID) \u00d7 (acc_ID / acc_OOD)"],
              ["Run environment", d.params.runEnv],
            ].map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  gap: "8px",
                  background: "white",
                  borderRadius: "4px",
                  padding: "10px 14px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  fontSize: "12.5px",
                }}
              >
                <span
                  style={{
                    color: v("--text-muted"),
                    minWidth: "120px",
                    flexShrink: 0,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  }}
                >
                  {key}
                </span>
                <span style={{ color: v("--text-primary"), fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Next Steps */}
        <section style={{ marginBottom: "48px" }}>
          <SectionLabel>What&apos;s Next</SectionLabel>
          <SectionTitle>Next Steps</SectionTitle>
          <ul
            style={{
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              margin: "16px 0",
              padding: 0,
            }}
          >
            {[
              {
                title: "Run Full Trust Score Report",
                desc: "Includes calibration, OOD robustness, and confidence inflation across shift types beyond temporal.",
              },
              {
                title: "Domain-Specific Eval",
                desc: "Bring your own data for a custom distribution shift eval against your production inputs.",
              },
              {
                title: "Vendor Comparison",
                desc: "Compare two or more specific AI vendors on this exact eval suite. Side-by-side CII, accuracy drop, and calibration deltas.",
              },
              {
                title: "Monitoring Setup Consultation",
                desc: "Define confidence thresholds and recalibration schedules based on these results.",
              },
            ].map((step, i) => (
              <li
                key={step.title}
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                  background: "white",
                  borderRadius: "8px",
                  padding: "16px 18px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: v("--agora-accent"),
                    color: "white",
                    fontSize: "12px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: "12.5px", color: v("--text-secondary") }}>
                    {step.desc}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* -- Footer -- */}
      <footer
        style={{
          background: v("--agora-dark"),
          color: "rgba(255,255,255,0.45)",
          textAlign: "center",
          padding: "28px 24px",
          fontSize: "12px",
          marginTop: "64px",
        }}
      >
        <strong style={{ color: "rgba(255,255,255,0.75)" }}>Report prepared by Agora</strong> — the
        AI vendor eval platform.
        <br />
        Questions about methodology, additional eval dimensions, or custom eval requests?
        <br />
        Reach out to{" "}
        <a
          href={`mailto:${d.contactEmail}`}
          style={{ color: v("--agora-accent2"), textDecoration: "none" }}
        >
          {d.contactEmail}
        </a>
        <div style={{ marginTop: "12px", fontSize: "11px", opacity: 0.5 }}>
          Agora Eval Report \u00b7 v1.0 \u00b7 Generated {d.runDate}
        </div>
      </footer>
    </div>
  );
}
