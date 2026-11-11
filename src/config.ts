import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const configSchema = z.object({
  // Files where raw colours and sizes are allowed because they define the tokens.
  tokenFiles: z.array(z.string()).default(["**/tokens.css", "**/theme.css", "**/tokens.ts", "**/theme.ts"]),
  ignore: z.array(z.string()).default(["**/node_modules/**", "**/dist/**", "**/*.test.*", "**/*.stories.*"]),
  // Exit with an error when a finding at this level (or worse) is present.
  failOn: z.enum(["error", "warning", "never"]).default("error"),
  disabledRules: z.array(z.string()).default([]),
});
export type Config = z.infer<typeof configSchema>;

export function loadConfig(cwd: string): Config {
  let raw: unknown = {};
  try {
    raw = JSON.parse(readFileSync(join(cwd, "ui-guard.config.json"), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw new Error(`ui-guard.config.json is not valid JSON: ${(e as Error).message}`);
  }
  return configSchema.parse(raw);
}

// Supports ** (any path), * (any characters except /) and ?.
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === "*" && glob[i + 1] === "*") {
      out += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

export function matchesAny(path: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(path));
}
