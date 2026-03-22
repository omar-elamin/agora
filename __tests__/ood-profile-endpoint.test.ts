import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockKvGet } = vi.hoisted(() => {
  const mockKvGet = vi.fn();
  return { mockKvGet };
});

vi.mock("@/lib/kv", () => ({
  kv: { get: mockKvGet, set: vi.fn(), del: vi.fn() },
  default: { get: mockKvGet, set: vi.fn(), del: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({
  validateApiKey: vi.fn(async (key: string | null) =>
    key === "valid-key"
      ? { valid: true }
      : { valid: false, error: "Invalid API key" },
  ),
}));

import { GET } from "@/app/api/v1/vendors/[vendor_id]/ood-profile/route";
import { NextRequest } from "next/server";

function makeRequest(
  vendor_id: string,
  apiKey: string | null,
  params?: Record<string, string>,
) {
  const url = new URL(`http://localhost/api/v1/vendors/${vendor_id}/ood-profile`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const headers = new Headers();
  if (apiKey) headers.set("x-api-key", apiKey);
  return new NextRequest(url, { headers });
}

const SAMPLE_OOD = {
  vendor_id: "deepgram",
  eval_date: "2026-03-20",
  id_ece: 0.04,
  id_accuracy: 0.92,
  id_n: 500,
  per_set_results: [
    {
      set_name: "noisy",
      shift_type: "noise",
      n_ood: 100,
      n_id: 500,
      id_ece: 0.04,
      ood_ece: 0.08,
      ece_shift: 0.04,
      id_accuracy: 0.92,
      ood_accuracy: 0.85,
      mean_conf_id: 0.9,
      mean_conf_ood: 0.82,
      cii: 1.05,
      auroc: 0.78,
    },
  ],
  mean_ece_shift: 0.04,
  max_cii: 1.05,
  ood_detection_auroc: 0.78,
};

describe("GET /api/v1/vendors/[vendor_id]/ood-profile", () => {
  beforeEach(() => {
    mockKvGet.mockReset();
  });

  it("returns 401 without valid API key", async () => {
    const req = makeRequest("deepgram", null);
    const res = await GET(req, { params: Promise.resolve({ vendor_id: "deepgram" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when no OOD data exists", async () => {
    mockKvGet.mockResolvedValue(null);
    const req = makeRequest("deepgram", "valid-key");
    const res = await GET(req, { params: Promise.resolve({ vendor_id: "deepgram" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("No OOD profile found for vendor");
  });

  it("returns 400 for invalid use_case_profile", async () => {
    const req = makeRequest("deepgram", "valid-key", { use_case_profile: "invalid" });
    const res = await GET(req, { params: Promise.resolve({ vendor_id: "deepgram" }) });
    expect(res.status).toBe(400);
  });

  it("returns OOD profile with PRS when data exists", async () => {
    mockKvGet.mockImplementation(async (key: string) => {
      if (key === "ood:deepgram:asr:latest") return SAMPLE_OOD;
      if (key === "trust:deepgram:asr:latest") return { trust_score: 0.85 };
      return null;
    });

    const req = makeRequest("deepgram", "valid-key");
    const res = await GET(req, { params: Promise.resolve({ vendor_id: "deepgram" }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.vendor_id).toBe("deepgram");
    expect(body.task_category).toBe("asr");
    expect(body.eval_date).toBe("2026-03-20");
    expect(body.id_ece).toBe(0.04);
    expect(body.id_accuracy).toBe(0.92);
    expect(body.per_set_results).toHaveLength(1);
    expect(body.aggregates.mean_ece_shift).toBe(0.04);
    expect(body.aggregates.max_cii).toBe(1.05);
    expect(body.aggregates.ood_detection_auroc).toBe(0.78);
    expect(body.prs_contribution).toBeDefined();
    expect(body.prs_contribution.prs_final).toBeGreaterThan(0);
    expect(body.prs_contribution.trust_score_id).toBe(0.85);
  });

  it("uses default trust score 0.5 when trust data missing", async () => {
    mockKvGet.mockImplementation(async (key: string) => {
      if (key === "ood:deepgram:asr:latest") return SAMPLE_OOD;
      return null;
    });

    const req = makeRequest("deepgram", "valid-key");
    const res = await GET(req, { params: Promise.resolve({ vendor_id: "deepgram" }) });
    const body = await res.json();
    expect(body.prs_contribution.trust_score_id).toBe(0.5);
  });

  it("respects task_category query param", async () => {
    mockKvGet.mockResolvedValue(null);
    const req = makeRequest("deepgram", "valid-key", { task_category: "sentiment" });
    await GET(req, { params: Promise.resolve({ vendor_id: "deepgram" }) });
    expect(mockKvGet).toHaveBeenCalledWith("ood:deepgram:sentiment:latest");
  });
});
