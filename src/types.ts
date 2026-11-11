export const CATEGORIES = ["a11y", "tokens", "perf"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Severity = "error" | "warning";

export type Finding = {
  ruleId: string;
  category: Category;
  severity: Severity;
  file: string;
  line: number;
  message: string;
  // "rules" for the deterministic layer, "claude" for the model review.
  source: "rules" | "claude";
};

// Line numbers (1-based, in the new version of the file) that a change touched.
// `null` means the whole file counts (a new file, or --all).
export type ChangedLines = Map<string, Set<number> | null>;
