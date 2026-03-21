"use client";

import PRSVendorCard from "../components/PRSVendorCard";
import type { PRSVendorData } from "../components/PRSVendorCard";

const VENDORS: { heading: string; vendor: PRSVendorData; compact?: boolean }[] = [
  {
    heading: "1. Healthy vendor — production-ready",
    vendor: {
      vendor_id: "v-001",
      vendor_name: "Acme Speech AI",
      components: {
        trust_score_ID: 0.91,
        mean_ECE_shift: 0.02,
        cii: 0.85,
        ood_detection_auroc: 0.95,
      },
    },
  },
  {
    heading: "2. Silent Drift Risk",
    vendor: {
      vendor_id: "v-002",
      vendor_name: "DriftLabs NLU",
      components: {
        trust_score_ID: 0.88,
        mean_ECE_shift: 0.14,
        cii: 1.45,
        ood_detection_auroc: 0.72,
      },
    },
  },
  {
    heading: "3. Trust floor active (trust_score_ID < 0.60)",
    vendor: {
      vendor_id: "v-003",
      vendor_name: "BudgetTranscribe",
      components: {
        trust_score_ID: 0.42,
        mean_ECE_shift: 0.05,
        cii: 1.1,
        ood_detection_auroc: 0.88,
      },
    },
  },
  {
    heading: "4. Missing data (2 null components)",
    vendor: {
      vendor_id: "v-004",
      vendor_name: "NewVendor Beta",
      components: {
        trust_score_ID: 0.78,
        mean_ECE_shift: 0.08,
        cii: null,
        ood_detection_auroc: null,
      },
    },
  },
  {
    heading: "5. Unevaluated vendor (all null)",
    vendor: {
      vendor_id: "v-005",
      vendor_name: "Stealth Startup Co.",
      components: {
        trust_score_ID: null,
        mean_ECE_shift: null,
        cii: null,
        ood_detection_auroc: null,
      },
    },
  },
  {
    heading: "6a. Compact — healthy",
    compact: true,
    vendor: {
      vendor_id: "v-001",
      vendor_name: "Acme Speech AI",
      components: {
        trust_score_ID: 0.91,
        mean_ECE_shift: 0.02,
        cii: 0.85,
        ood_detection_auroc: 0.95,
      },
    },
  },
  {
    heading: "6b. Compact — SDR + trust floor",
    compact: true,
    vendor: {
      vendor_id: "v-006",
      vendor_name: "RiskyModel Inc.",
      components: {
        trust_score_ID: 0.5,
        mean_ECE_shift: 0.18,
        cii: 1.6,
        ood_detection_auroc: 0.6,
      },
    },
  },
  {
    heading: "6c. Compact — unevaluated",
    compact: true,
    vendor: {
      vendor_id: "v-007",
      vendor_name: "GhostVendor",
      components: {
        trust_score_ID: null,
        mean_ECE_shift: null,
        cii: null,
        ood_detection_auroc: null,
      },
    },
  },
];

export default function PRSDemoPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "40px 16px 80px",
      }}
    >
      <h1
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#f9fafb",
          marginBottom: 32,
        }}
      >
        PRS Vendor Card — Demo
      </h1>

      {VENDORS.map((item) => (
        <section key={`${item.vendor.vendor_id}-${item.heading}`} style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 10,
            }}
          >
            {item.heading}
          </h2>
          <PRSVendorCard vendor={item.vendor} compact={item.compact} />
        </section>
      ))}
    </main>
  );
}
