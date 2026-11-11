import { execFileSync } from "node:child_process";
import type { ChangedLines } from "./types.js";

// Parses `git diff --unified=0` output into the added or modified line
// numbers of each file. Deleted files are skipped: there is nothing left to review.
export function parseUnifiedDiff(diff: string): ChangedLines {
  const changed: ChangedLines = new Map();
  let file: string | null = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = line.slice(4).trim();
      file = path === "/dev/null" ? null : path.replace(/^b\//, "");
      if (file && !changed.has(file)) changed.set(file, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      const lines = changed.get(file);
      for (let n = start; n < start + count; n++) lines?.add(n);
    }
  }

  // A file that only lost lines has no new lines to review.
  for (const [path, lines] of changed) {
    if (lines && lines.size === 0) changed.delete(path);
  }
  return changed;
}

export function gitDiff(base: string, cwd: string): string {
  return execFileSync("git", ["diff", "--unified=0", "--no-color", "--diff-filter=AMR", `${base}...HEAD`], {
    cwd,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
}

export function isChanged(changed: ChangedLines, file: string, line: number): boolean {
  if (!changed.has(file)) return false;
  const lines = changed.get(file);
  return lines === null || lines!.has(line);
}
