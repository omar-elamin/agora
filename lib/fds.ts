/**
 * Failure Detectability Score (FDS) computation for the language validation probe.
 *
 * FDS = (failures caught by probe as "disagree") / (total failures)
 *
 * Where "caught" means probe_result.result === "disagree" on an item
 * where the primary model's output was wrong.
 */

export interface ProbeEvalItem {
  /** Whether the primary model's output was correct (ground truth match) */
  is_correct: boolean;
  /** The probe's result for this item */
  probe_result: "agree" | "disagree" | "probe_skipped_short" | "script_mismatch";
}

export interface ProbeFDSResult {
  /** Total number of failures (incorrect outputs) */
  total_failures: number;
  /** Failures where probe said "disagree" (caught) */
  failures_caught: number;
  /** FDS score: failures_caught / total_failures, or null if no failures */
  fds: number | null;
}

/**
 * Compute the Failure Detectability Score from a set of evaluated items.
 */
export function computeProbeFDS(items: ProbeEvalItem[]): ProbeFDSResult {
  const failures = items.filter((item) => !item.is_correct);
  const totalFailures = failures.length;

  if (totalFailures === 0) {
    return { total_failures: 0, failures_caught: 0, fds: null };
  }

  const failuresCaught = failures.filter(
    (item) => item.probe_result === "disagree" || item.probe_result === "script_mismatch",
  ).length;

  return {
    total_failures: totalFailures,
    failures_caught: failuresCaught,
    fds: parseFloat((failuresCaught / totalFailures).toFixed(4)),
  };
}
