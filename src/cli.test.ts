import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const CLI = join(import.meta.dirname, "cli.ts");
// Resolved here, because the CLI runs inside a temp repo with no node_modules.
const TSX = import.meta.resolve("tsx");

function git(cwd: string, ...args: string[]) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

// A repo where main already has an old problem and the branch adds new ones.
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "uig-cli-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  writeFileSync(join(dir, "Card.tsx"), `export const Card = () => (\n  <div>\n    <img src="old.png" />\n  </div>\n);\n`);
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "base");
  git(dir, "checkout", "-q", "-b", "feature");
  writeFileSync(
    join(dir, "Card.tsx"),
    `export const Card = ({ go }) => (\n  <div>\n    <img src="old.png" />\n    <div onClick={go}>Open</div>\n    <p style={{ color: "#ff0000" }}>x</p>\n  </div>\n);\n`,
  );
  git(dir, "commit", "-qam", "change");
  return dir;
}

function run(cwd: string, ...args: string[]) {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  return spawnSync(process.execPath, ["--import", TSX, CLI, ...args], { cwd, env, encoding: "utf8" });
}

describe("cli", () => {
  it("reports only problems on lines the branch changed, and fails on errors", () => {
    const dir = repo();
    const result = run(dir, "--base", "main", "--json", "out.json");
    const out = JSON.parse(readFileSync(join(dir, "out.json"), "utf8"));
    const found = out.findings.map((f: { ruleId: string; line: number }) => `${f.ruleId}@${f.line}`);
    // The old <img> on line 3 is not part of this change.
    assert.deepEqual(found, ["click-on-static@4", "raw-color@5"]);
    assert.equal(result.status, 1);
    assert.equal(out.claude.note, "no ANTHROPIC_API_KEY");
  });

  it("passes when failOn is never, and writes a Markdown comment", () => {
    const dir = repo();
    writeFileSync(join(dir, "ui-guard.config.json"), JSON.stringify({ failOn: "never" }));
    const result = run(dir, "--base", "main", "--markdown", "report.md");
    assert.equal(result.status, 0);
    const md = readFileSync(join(dir, "report.md"), "utf8");
    assert.match(md, /<!-- ui-guard -->/);
    assert.match(md, /1 error, 1 warning/);
    assert.match(md, /`Card.tsx:4` `click-on-static`/);
  });

  it("exits 2 with a clear message when the base ref does not exist", () => {
    const dir = repo();
    const result = run(dir, "--base", "nope");
    assert.equal(result.status, 2);
  });
});
