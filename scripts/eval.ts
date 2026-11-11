// Measures the rule layer against seeded defects in eval/fixtures.
// A finding counts as a hit when file, line and category match a label.
//
//   npm run eval            rules only
//   npm run eval -- --claude   rules + Claude (needs ANTHROPIC_API_KEY)
import Anthropic from "@anthropic-ai/sdk";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { reviewWithClaude } from "../src/claude.js";
import { loadConfig } from "../src/config.js";
import { runRules, UI_FILE } from "../src/review.js";
import { CATEGORIES, type ChangedLines, type Finding } from "../src/types.js";

const { values } = parseArgs({ options: { claude: { type: "boolean", default: false } } });
const root = join(import.meta.dirname, "..", "eval", "fixtures");

type Label = { file: string; snippet: string; category: (typeof CATEGORIES)[number]; defect: string };
const { labels } = JSON.parse(readFileSync(join(import.meta.dirname, "..", "eval", "labels.json"), "utf8")) as { labels: Label[] };

// Resolve each label's snippet to exactly one line.
const expected = labels.map((label) => {
  const lines = readFileSync(join(root, label.file), "utf8").split("\n");
  const hits = lines.flatMap((l, i) => (l.includes(label.snippet) ? [i + 1] : []));
  if (hits.length !== 1) throw new Error(`Label snippet must match exactly one line in ${label.file}: ${label.snippet} (matched ${hits.length})`);
  return { ...label, line: hits[0]! };
});

const changed: ChangedLines = new Map();
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs);
    else if (UI_FILE.test(name)) changed.set(relative(root, abs), null);
  }
};
walk(root);

let findings: Finding[] = runRules(root, changed, loadConfig(root));
let claudeNote = "not run";
if (values.claude) {
  const review = await reviewWithClaude(new Anthropic(), root, [...changed.keys()], changed, findings);
  findings = [...findings, ...review.findings];
  claudeNote = `ran; ${review.findings.length} extra findings, ${review.dropped} dropped, ${review.inputTokens} input / ${review.outputTokens} output tokens`;
}

const key = (f: { file: string; line: number; category: string }) => `${f.file}:${f.line}:${f.category}`;
const labelKeys = new Set(expected.map(key));
const findingKeys = new Set(findings.map(key));

const hits = expected.filter((l) => findingKeys.has(key(l)));
const misses = expected.filter((l) => !findingKeys.has(key(l)));
const falsePositives = [...findingKeys].filter((k) => !labelKeys.has(k));
const cleanFalsePositives = falsePositives.filter((k) => k.startsWith("clean/"));

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${Math.round((100 * n) / d)}%`);
const perCategory = Object.fromEntries(
  CATEGORIES.map((c) => {
    const all = expected.filter((l) => l.category === c);
    const caught = hits.filter((l) => l.category === c);
    return [c, `${caught.length}/${all.length} (${pct(caught.length, all.length)})`];
  }),
);

console.log(
  JSON.stringify(
    {
      seededDefects: expected.length,
      caught: hits.length,
      recall: pct(hits.length, expected.length),
      recallByCategory: perCategory,
      distinctFindings: findingKeys.size,
      precision: pct(findingKeys.size - falsePositives.length, findingKeys.size),
      falsePositivesOnCleanFiles: cleanFalsePositives.length,
      falsePositives,
      claude: claudeNote,
      missed: misses.map((m) => `${m.file}:${m.line} [${m.category}] ${m.defect}`),
    },
    null,
    2,
  ),
);
