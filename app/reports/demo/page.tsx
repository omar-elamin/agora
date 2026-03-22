import OodReportView from "@/app/reports/OodReportView";
import type { OodReportData } from "@/app/types/ood-report";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agora Eval Report — Temporal OOD Demo (HuffPost)",
};

const DEMO_DATA: OodReportData = {
  reportTitle: "Temporal OOD Eval — HuffPost Demo",
  evalType: "Temporal OOD",
  customerName: "HuffPost (Demo)",
  runDate: "2026-03-21",

  execSummary:
    "This eval measures how well two text classifiers maintain accuracy when applied to news articles published after their training cutoff. " +
    "DistilBERT shows a 9-point accuracy drop on out-of-distribution data vs. 15 points for TF-IDF. " +
    "Both models exhibit concerning overconfidence under distribution shift, though DistilBERT's confidence inflation is within acceptable bounds.",

  dataset: {
    name: "HuffPost News Category Dataset",
    source: "Kaggle / Rishabh Misra",
    license: "CC BY-4.0",
    totalRecords: "209,527",
    dateRange: "2012\u20132022",
    task: "Multi-class news category classification (41 classes \u2192 reduced to 6 for this eval)",
    inputFormat: "Headline + short description, concatenated",
  },

  splits: {
    trainDates: "2012\u20132017",
    trainSize: "142,831",
    devDates: "2018",
    devSize: "28,433",
    oodDates: "2019\u20132022",
    oodSize: "4,821",
    cutoff: "Dec 31, 2017",
  },

  modelA: {
    name: "TF-IDF + LogReg",
    description: "Sparse bag-of-words baseline",
    trainTime: "2m",
    hardware: "CPU",
    trainAcc: "73%",
    oodAcc: "58%",
    delta: "\u221215 pp",
    f1Train: "0.71",
    f1Ood: "0.54",
    confTrain: "0.81",
    confOod: "0.79",
    cii: "1.47",
  },

  modelB: {
    name: "DistilBERT (fine-tuned)",
    description: "Transformer fine-tuned on news classification",
    trainTime: "18m",
    hardware: "A10G GPU",
    trainAcc: "89%",
    oodAcc: "80%",
    delta: "\u22129 pp",
    f1Train: "0.88",
    f1Ood: "0.78",
    confTrain: "0.92",
    confOod: "0.87",
    cii: "1.08",
  },

  oodTestSize: "4,821",

  categories: [
    {
      name: "POLITICS",
      trainAcc: "81%",
      oodAcc: "62%",
      delta: "\u221219 pp",
      notes: "Rapid vocabulary shift in political reporting post-2017",
      severity: "red",
    },
    {
      name: "SPORTS",
      trainAcc: "92%",
      oodAcc: "88%",
      delta: "\u22124 pp",
      notes: "Structured language; new athlete names are the main shift",
      severity: "yellow",
    },
    {
      name: "TECH",
      trainAcc: "85%",
      oodAcc: "76%",
      delta: "\u22129 pp",
      notes: "New product names and emerging technology vocabulary",
      severity: "orange",
    },
    {
      name: "ENTERTAINMENT",
      trainAcc: "78%",
      oodAcc: "71%",
      delta: "\u22127 pp",
      notes: "New celebrity names and show titles reduce lexical overlap",
      severity: "orange",
    },
    {
      name: "TRAVEL",
      trainAcc: "74%",
      oodAcc: "73%",
      delta: "\u22121 pp",
      notes: "Stable vocabulary; destination names rotate but language patterns persist",
      severity: "green",
    },
    {
      name: "FOOD",
      trainAcc: "88%",
      oodAcc: "87%",
      delta: "\u22121 pp",
      notes: "Highly stable category language over time",
      severity: "green",
    },
  ],

  driftCurveCaption:
    "DistilBERT maintains higher accuracy throughout the OOD window but both models show accelerating degradation after 2020, likely driven by COVID-19 vocabulary shift.",

  categoryChartCaption:
    "Politics shows the largest drift (\u221219 pp), consistent with rapid vocabulary shift in political reporting. Sports and Food are most stable.",

  params: {
    tfidfFeatures: "50,000 unigrams + bigrams",
    logReg: "C=1.0, max_iter=1000, solver=lbfgs",
    transformer: "distilbert-base-uncased",
    finetune: "3 epochs, lr=2e-5, batch=32",
    calibration: "ECE (15 bins)",
    runEnv: "Python 3.11, scikit-learn 1.4, HuggingFace transformers 4.38",
  },

  limitations: {
    testSetSize:
      "4,821 OOD records is sufficient for aggregate accuracy but thin for per-category analysis in smaller classes.",
    textFormat:
      "Headline + description only \u2014 excludes full article body. Production inputs may be structurally different.",
    sourceBias:
      "Single publisher (HuffPost). Results may not generalize to news from other outlets or non-English text.",
    labelConsistency:
      "Category labels were assigned by HuffPost editors over a 10-year span. Label definitions may have shifted subtly over time.",
    attribution:
      "Dataset by Rishabh Misra, licensed CC BY-4.0. Cite: Misra, R. (2022). News Category Dataset.",
  },

  contactEmail: "hello@agora.ai",
  ownerApiKey: "",
};

export default function DemoReportPage() {
  return <OodReportView data={DEMO_DATA} />;
}
