#!/usr/bin/env node
import Anthropic from "@anthropic-ai/sdk";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { reviewWithClaude, ReviewFailed, ReviewRefused } from "./claude.js";
import { loadConfig, matchesAny } from "./config.js";
import { gitDiff, parseUnifiedDiff } from "./diff.js";
import { toMarkdown } from "./report.js";
import { runRules, sortFindings, UI_FILE } from "./review.js";
import type { ChangedLines } from "./types.js";

const HELP = `Usage: ui-guard [options] [paths...]

Reviews UI code (TSX, JSX, CSS) for accessibility, design-token and performance problems.

  --base <ref>       Review lines changed since this git ref (default: origin/main)
  --all              Review every line of the given paths instead of a diff
  --markdown <file>  Write the Markdown report (for a PR comment) to a file
  --json <file>      Write findings as JSON to a file
  --no-claude        Skip the Claude review even if ANTHROPIC_API_KEY is set
  -h, --help         Show this help

The Claude review runs when ANTHROPIC_API_KEY is set. Exit code 1 means
findings at or above "failOn" in ui-guard.config.json (default: error).`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: "string", default: "origin/main" },
      all: { type: "boolean", default: false },
      markdown: { type: "string" },
      json: { type: "string" },
      "no-claude": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const changed: ChangedLines = values.all ? walk(cwd, positionals.length ? positionals : ["."], config.ignore) : parseUnifiedDiff(gitDiff(values.base!, cwd));

  const files = [...changed.keys()].filter((f) => UI_FILE.test(f) && !matchesAny(f, config.ignore));
  const ruleFindings = runRules(cwd, changed, config);

  let claude = { ran: false, skipped: [] as string[], dropped: 0, note: undefined as string | undefined };
  let findings = ruleFindings;

  if (!values["no-claude"] && process.env.ANTHROPIC_API_KEY && files.length > 0) {
    try {
      const review = await reviewWithClaude(new Anthropic(), cwd, files, changed, ruleFindings);
      findings = sortFindings([...ruleFindings, ...review.findings]);
      claude = { ran: true, skipped: review.skipped, dropped: review.dropped, note: undefined };
    } catch (e) {
      // A failed model call must not hide the rule results.
      const note = e instanceof ReviewRefused || e instanceof ReviewFailed ? e.message : "the API call failed";
      claude = { ran: false, skipped: [], dropped: 0, note };
      console.error(`Claude review skipped: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (!process.env.ANTHROPIC_API_KEY) {
    claude.note = "no ANTHROPIC_API_KEY";
  }

  const markdown = toMarkdown({ findings, filesReviewed: files.length, scope: values.all ? "all" : "diff", claude });
  if (values.markdown) writeFileSync(values.markdown, markdown + "\n");
  if (values.json) writeFileSync(values.json, JSON.stringify({ findings, filesReviewed: files.length, claude }, null, 2) + "\n");
  if (!values.markdown && !values.json) console.log(markdown);

  const errors = findings.some((f) => f.severity === "error");
  if (config.failOn === "error" && errors) return 1;
  if (config.failOn === "warning" && findings.length > 0) return 1;
  return 0;
}

// --all: every UI file under the given paths, every line counts.
function walk(cwd: string, paths: string[], ignore: string[]): ChangedLines {
  const out: ChangedLines = new Map();
  const visit = (abs: string) => {
    const rel = relative(cwd, abs) || ".";
    if (matchesAny(rel, ignore) || rel.split("/").includes("node_modules")) return;
    const stat = statSync(abs);
    if (stat.isDirectory()) readdirSync(abs).forEach((name) => visit(join(abs, name)));
    else if (UI_FILE.test(rel)) out.set(rel, null);
  };
  paths.forEach((p) => visit(join(cwd, p)));
  return out;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  },
);
