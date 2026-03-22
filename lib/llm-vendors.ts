import type { DatasetRow } from "./datasets";

export interface VendorResult {
  accuracy: number;
  avg_latency_ms: number;
  estimated_cost_usd: number;
  correct: number;
  total: number;
  error?: string;
}

export interface VendorBenchmarkResult {
  vendors_tested: string[];
  rows_evaluated: number;
  per_vendor: Record<string, VendorResult>;
  ranking: Array<{ vendor: string; rank: number; score: number }>;
  comparison_table: Array<{
    vendor: string;
    accuracy: string;
    avg_latency_ms: number;
    cost_usd: string;
    rank: number;
  }>;
}

// Cost per 1K tokens (input+output blended)
const COST_PER_1K_TOKENS: Record<string, number> = {
  "gpt-4o": 0.005,
  "claude-3-5-haiku-20241022": 0.001,
  "gemini-2.0-flash": 0.0002,
};

const VALID_LABELS = [
  "pre_2020",
  "2020",
  "2021",
  "2022",
  "2023",
  "2024",
  "post_2024",
];

const CLASSIFICATION_PROMPT =
  "Classify the temporal category of this Wikipedia passage. Respond with ONLY the label, one of: pre_2020, 2020, 2021, 2022, 2023, 2024, post_2024. Passage: ";

function getApiKey(vendor: string): string | null {
  switch (vendor) {
    case "gpt-4o":
      return process.env.OPENAI_API_KEY ?? null;
    case "claude-3-5-haiku-20241022":
      return process.env.ANTHROPIC_API_KEY ?? null;
    case "gemini-2.0-flash":
      return process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null;
    default:
      return null;
  }
}

function estimateTokens(text: string): number {
  // Rough: ~4 chars per token
  return Math.ceil(text.length / 4);
}

async function callOpenAI(
  apiKey: string,
  prompt: string
): Promise<{ response: string; latency_ms: number; tokens: number }> {
  const start = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 20,
      temperature: 0,
    }),
  });
  const latency_ms = Date.now() - start;
  const data = await res.json();
  const response = data.choices?.[0]?.message?.content?.trim() ?? "";
  const tokens =
    (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);
  return { response, latency_ms, tokens: tokens || estimateTokens(prompt) + 10 };
}

async function callAnthropic(
  apiKey: string,
  prompt: string
): Promise<{ response: string; latency_ms: number; tokens: number }> {
  const start = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 20,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const latency_ms = Date.now() - start;
  const data = await res.json();
  const response =
    data.content?.[0]?.type === "text" ? data.content[0].text.trim() : "";
  const tokens =
    (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
  return { response, latency_ms, tokens: tokens || estimateTokens(prompt) + 10 };
}

async function callGemini(
  apiKey: string,
  prompt: string
): Promise<{ response: string; latency_ms: number; tokens: number }> {
  const start = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 20, temperature: 0 },
    }),
  });
  const latency_ms = Date.now() - start;
  const data = await res.json();
  const response =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const tokens = estimateTokens(prompt) + 10;
  return { response, latency_ms, tokens };
}

async function callVendor(
  vendor: string,
  apiKey: string,
  prompt: string
): Promise<{ response: string; latency_ms: number; tokens: number }> {
  switch (vendor) {
    case "gpt-4o":
      return callOpenAI(apiKey, prompt);
    case "claude-3-5-haiku-20241022":
      return callAnthropic(apiKey, prompt);
    case "gemini-2.0-flash":
      return callGemini(apiKey, prompt);
    default:
      throw new Error(`Unsupported vendor: ${vendor}`);
  }
}

function normalizeLabel(raw: string): string {
  const cleaned = raw.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
  // Match against valid labels
  for (const label of VALID_LABELS) {
    if (cleaned === label.replace(/_/g, "")) return label;
    if (cleaned === label) return label;
  }
  // Fuzzy: check if any valid label is contained
  for (const label of VALID_LABELS) {
    if (cleaned.includes(label.replace(/_/g, "")) || cleaned.includes(label))
      return label;
  }
  return raw.trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLLMVendors(
  rows: DatasetRow[],
  vendors: string[],
  opts?: { limit?: number }
): Promise<VendorBenchmarkResult> {
  const limit = opts?.limit ?? 50;
  const evalRows = rows.slice(0, limit);
  const perVendor: Record<string, VendorResult> = {};
  const testedVendors: string[] = [];

  // Run vendors sequentially to avoid rate limits
  for (const vendor of vendors) {
    const apiKey = getApiKey(vendor);
    if (!apiKey) {
      perVendor[vendor] = {
        accuracy: 0,
        avg_latency_ms: 0,
        estimated_cost_usd: 0,
        correct: 0,
        total: 0,
        error: `Missing API key for ${vendor}`,
      };
      testedVendors.push(vendor);
      continue;
    }

    const costRate = COST_PER_1K_TOKENS[vendor] ?? 0.001;

    // Run rows in parallel with Promise.allSettled
    const rowPromises = evalRows.map((row, idx) =>
      (async () => {
        // Stagger requests: 100ms delay between rows
        if (idx > 0) await delay(idx * 100);
        const prompt = CLASSIFICATION_PROMPT + row.text;
        const result = await callVendor(vendor, apiKey, prompt);
        const predicted = normalizeLabel(result.response);
        const correct = predicted === row.label;
        return {
          correct,
          latency_ms: result.latency_ms,
          tokens: result.tokens,
        };
      })()
    );

    const results = await Promise.allSettled(rowPromises);

    let correctCount = 0;
    let totalLatency = 0;
    let totalTokens = 0;
    let successCount = 0;

    for (const r of results) {
      if (r.status === "fulfilled") {
        successCount++;
        if (r.value.correct) correctCount++;
        totalLatency += r.value.latency_ms;
        totalTokens += r.value.tokens;
      }
    }

    const total = successCount || 1;
    perVendor[vendor] = {
      accuracy: correctCount / total,
      avg_latency_ms: Math.round(totalLatency / total),
      estimated_cost_usd: (totalTokens / 1000) * costRate,
      correct: correctCount,
      total: successCount,
    };
    testedVendors.push(vendor);
  }

  // Build ranking: accuracy desc, latency asc as tiebreak
  const ranked = testedVendors
    .filter((v) => !perVendor[v].error)
    .sort((a, b) => {
      const accDiff = perVendor[b].accuracy - perVendor[a].accuracy;
      if (Math.abs(accDiff) > 0.001) return accDiff;
      return perVendor[a].avg_latency_ms - perVendor[b].avg_latency_ms;
    });

  // Include errored vendors at the end
  const errored = testedVendors.filter((v) => perVendor[v].error);
  const fullRanked = [...ranked, ...errored];

  const ranking = fullRanked.map((vendor, i) => ({
    vendor,
    rank: i + 1,
    score: perVendor[vendor].accuracy,
  }));

  const comparison_table = fullRanked.map((vendor, i) => ({
    vendor,
    accuracy: (perVendor[vendor].accuracy * 100).toFixed(1) + "%",
    avg_latency_ms: perVendor[vendor].avg_latency_ms,
    cost_usd: "$" + perVendor[vendor].estimated_cost_usd.toFixed(4),
    rank: i + 1,
  }));

  return {
    vendors_tested: testedVendors,
    rows_evaluated: evalRows.length,
    per_vendor: perVendor,
    ranking,
    comparison_table,
  };
}
