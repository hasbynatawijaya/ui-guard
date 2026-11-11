import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchesAny, type Config } from "./config.js";
import { isChanged } from "./diff.js";
import { checkCss } from "./rules/css.js";
import { checkJsx } from "./rules/jsx.js";
import type { ChangedLines, Finding } from "./types.js";

export const UI_FILE = /\.(tsx|jsx|css)$/;

// Runs the deterministic rules on every changed UI file and keeps findings on
// changed lines only, so a pull request is judged on what it adds.
export function runRules(cwd: string, changed: ChangedLines, config: Config): Finding[] {
  const findings: Finding[] = [];
  for (const file of changed.keys()) {
    if (!UI_FILE.test(file) || matchesAny(file, config.ignore)) continue;
    let source: string;
    try {
      source = readFileSync(join(cwd, file), "utf8");
    } catch {
      continue; // renamed away or unreadable
    }
    const found = file.endsWith(".css") ? checkCss(file, source, matchesAny(file, config.tokenFiles)) : checkJsx(file, source);
    for (const f of found) {
      if (!config.disabledRules.includes(f.ruleId) && isChanged(changed, file, f.line)) findings.push(f);
    }
  }
  return sortFindings(findings);
}

export function sortFindings(findings: Finding[]): Finding[] {
  const rank = { error: 0, warning: 1 };
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || rank[a.severity] - rank[b.severity]);
}
