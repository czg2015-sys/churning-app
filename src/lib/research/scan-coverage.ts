// Pure summary shared by the monitoring agent and its regression tests.
// A completed scan must not imply that blocked or unreadable official
// pages were successfully verified.
export type SourceChangeStatus = "baseline" | "unchanged" | "changed" | "unreachable";

export function summarizeSourceCoverage(values: SourceChangeStatus[]) {
  const counts = values.reduce((acc, value) => {
    if (value === "baseline") acc.baseline += 1;
    else if (value === "unchanged") acc.unchanged += 1;
    else if (value === "changed") acc.changed += 1;
    else acc.unreachable += 1;
    return acc;
  }, { baseline: 0, unchanged: 0, changed: 0, unreachable: 0 });

  const readable = counts.baseline + counts.unchanged + counts.changed;
  const total = values.length;
  const status = counts.unreachable > 0 ? "partial" as const : "completed" as const;
  const message = counts.unreachable > 0
    ? `Partial coverage: ${readable} of ${total} official pages readable; ${counts.unreachable} unreachable or blocked. Inspect findings before treating offer data as current.`
    : null;

  return { ...counts, readable, total, status, message };
}
