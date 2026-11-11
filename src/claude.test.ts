import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { reviewWithClaude, ReviewRefused } from "./claude.js";
import { RUBRIC } from "./rubric.js";
import type { ChangedLines, Finding } from "./types.js";

// A stand-in for the SDK client that returns a canned response.
function fakeClient(response: object): Anthropic {
  return { beta: { messages: { create: async () => response } } } as unknown as Anthropic;
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "uig-"));
  writeFileSync(join(dir, "A.tsx"), "line1\nline2\nline3\nline4\n");
  const changed: ChangedLines = new Map([["A.tsx", new Set([2, 3])]]);
  return { dir, changed };
}

const ok = (findings: object[]) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify({ findings }) }],
  usage: { input_tokens: 100, output_tokens: 20 },
});

describe("reviewWithClaude", () => {
  it("keeps findings on changed lines and drops invented or duplicate ones", async () => {
    const { dir, changed } = setup();
    const rule: Finding = { ruleId: "img-alt", category: "a11y", severity: "error", file: "A.tsx", line: 2, message: "x", source: "rules" };
    const review = await reviewWithClaude(
      fakeClient(
        ok([
          { file: "A.tsx", line: 3, category: "perf", severity: "warning", message: "kept" },
          { file: "A.tsx", line: 4, category: "a11y", severity: "error", message: "unchanged line" },
          { file: "B.tsx", line: 2, category: "a11y", severity: "error", message: "file never sent" },
          { file: "A.tsx", line: 2, category: "a11y", severity: "error", message: "duplicate of rule" },
        ]),
      ),
      dir,
      ["A.tsx"],
      changed,
      [rule],
    );
    assert.deepEqual(review.findings.map((f) => f.message), ["kept"]);
    assert.equal(review.dropped, 3);
    assert.equal(review.findings[0]?.source, "claude");
  });

  it("reports a refusal instead of returning an empty review", async () => {
    const { dir, changed } = setup();
    await assert.rejects(
      reviewWithClaude(fakeClient({ stop_reason: "refusal", content: [], usage: { input_tokens: 1, output_tokens: 0 } }), dir, ["A.tsx"], changed, []),
      ReviewRefused,
    );
  });
});

describe("skill", () => {
  it("contains the same rubric the CLI sends to Claude", () => {
    const skill = readFileSync(new URL("../skill/ui-guard/SKILL.md", import.meta.url), "utf8");
    assert.ok(skill.includes(RUBRIC), "skill/ui-guard/SKILL.md is out of sync with src/rubric.ts");
  });
});
