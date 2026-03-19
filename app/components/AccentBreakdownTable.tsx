"use client";

import { useState, useMemo } from "react";
import type { AccentGroupData, CqsTier } from "../types/cqs";
import CqsBadge from "./CqsBadge";
import styles from "./AccentBreakdownTable.module.css";

type SortKey = "accent" | "wer" | "ece" | "cqs" | "clips";
type SortDir = "asc" | "desc";

const CQS_ORDER: Record<CqsTier, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  unknown: 3,
};

export default function AccentBreakdownTable({
  data,
}: {
  data: AccentGroupData[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("wer");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === "cqs") {
        cmp = CQS_ORDER[a.cqs] - CQS_ORDER[b.cqs];
      } else if (sortKey === "accent") {
        cmp = a.accent.localeCompare(b.accent);
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "accent" ? "asc" : "desc");
    }
  }

  function arrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Accent Group Breakdown</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            {(
              [
                ["accent", "Accent Group"],
                ["wer", "WER"],
                ["ece", "ECE"],
                ["cqs", "Confidence Reliability"],
                ["clips", "Clips"],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <th
                key={key}
                className={styles.th}
                onClick={() => handleSort(key)}
              >
                {label}
                <span className={styles.arrow}>{arrow(key)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.accent} className={styles.row}>
              <td className={styles.td}>{row.accent}</td>
              <td className={styles.td}>{row.wer.toFixed(1)}%</td>
              <td className={styles.td}>{row.ece.toFixed(3)}</td>
              <td className={styles.td}>
                <CqsBadge tier={row.cqs} />
              </td>
              <td className={styles.tdRight}>
                {row.clips.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
