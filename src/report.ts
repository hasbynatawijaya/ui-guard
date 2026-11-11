import type { Finding } from "./types.js";

export const COMMENT_MARKER = "<!-- ui-guard -->";

export type ReportInput = {
  findings: Finding[];
  filesReviewed: number;
  // "diff" reviews changed lines; "all" reviews whole files (--all).
  scope?: "diff" | "all";
  claude: { ran: boolean; skipped: string[]; dropped: number; note?: string };
};

const ICON = { error: "🔴", warning: "🟡" };
const CATEGORY = { a11y: "Accessibility", tokens: "Design tokens", perf: "Performance" };

// Markdown for the PR comment. The marker lets the Action update one comment
// instead of adding a new one on every push.
export function toMarkdown({ findings, filesReviewed, scope = "diff", claude }: ReportInput): string {
  const where = scope === "diff" ? "on changed lines in" : "in";
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.length - errors;
  const lines = [COMMENT_MARKER, "## UI Guard", ""];

  if (findings.length === 0) {
    lines.push(`No problems found ${where} ${filesReviewed} UI file${filesReviewed === 1 ? "" : "s"}.`);
  } else {
    lines.push(`${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"} ${where} ${filesReviewed} UI file${filesReviewed === 1 ? "" : "s"}.`, "");
    for (const category of ["a11y", "tokens", "perf"] as const) {
      const group = findings.filter((f) => f.category === category);
      if (group.length === 0) continue;
      lines.push(`### ${CATEGORY[category]}`, "");
      for (const f of group) {
        const by = f.source === "claude" ? " _(Claude)_" : ` \`${f.ruleId}\``;
        lines.push(`- ${ICON[f.severity]} \`${f.file}:${f.line}\`${by}: ${escapeMd(f.message)}`);
      }
      lines.push("");
    }
  }

  lines.push("");
  if (!claude.ran) lines.push(`<sub>Claude review: off${claude.note ? ` (${claude.note})` : ""}. Rule checks only.</sub>`);
  else {
    const extras = [
      claude.skipped.length ? `skipped ${claude.skipped.length} large file(s): ${claude.skipped.join(", ")}` : "",
      claude.dropped ? `dropped ${claude.dropped} finding(s) outside the changed lines or already reported` : "",
    ].filter(Boolean);
    lines.push(`<sub>Rule checks and Claude review.${extras.length ? " " + extras.join("; ") + "." : ""}</sub>`);
  }
  return lines.join("\n");
}

function escapeMd(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
