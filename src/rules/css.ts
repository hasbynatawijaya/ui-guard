import type { Finding } from "../types.js";

type Declaration = { prop: string; value: string; line: number };
type Rule = { selector: string; declarations: Declaration[] };

const COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;
const COLOR_PROPS = /^(color|background|background-color|border|border-color|border-top|border-bottom|border-left|border-right|outline-color|fill|stroke|box-shadow|text-decoration-color)$/;

// A small parser: enough to find declarations, their selector and their line.
// Comments are blanked out first, keeping newlines so line numbers stay right.
export function parseCss(source: string): Rule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const rules: Rule[] = [];
  const stack: Rule[] = [];
  let buffer = "";
  let bufferStart = 0;
  let line = 1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "{") {
      const rule: Rule = { selector: buffer.trim(), declarations: [] };
      stack.push(rule);
      rules.push(rule);
      buffer = "";
      bufferStart = line;
    } else if (ch === "}" || ch === ";") {
      const current = stack[stack.length - 1];
      const decl = buffer.trim();
      if (current && decl.includes(":")) {
        const colon = decl.indexOf(":");
        // Line of the declaration's first non-space character.
        const leading = buffer.slice(0, buffer.length - buffer.trimStart().length);
        const declLine = bufferStart + (leading.match(/\n/g)?.length ?? 0);
        current.declarations.push({ prop: decl.slice(0, colon).trim().toLowerCase(), value: decl.slice(colon + 1).trim(), line: declLine });
      }
      if (ch === "}") stack.pop();
      buffer = "";
      bufferStart = line;
    } else {
      if (buffer === "") bufferStart = line;
      buffer += ch;
    }
    if (ch === "\n") line++;
  }
  return rules;
}

export function checkCss(file: string, source: string, isTokenFile: boolean): Finding[] {
  const findings: Finding[] = [];
  const push = (line: number, f: Omit<Finding, "file" | "line" | "source">) => findings.push({ ...f, file, line, source: "rules" });

  for (const rule of parseCss(source)) {
    if (rule.selector.startsWith("@")) continue;
    const props = new Set(rule.declarations.map((d) => d.prop));

    for (const d of rule.declarations) {
      // Defining a custom property is how tokens are made, so it's allowed.
      if (!isTokenFile && !d.prop.startsWith("--") && COLOR_PROPS.test(d.prop) && COLOR.test(d.value)) {
        push(d.line, { ruleId: "raw-color", category: "tokens", severity: "warning", message: `Hard-coded colour in ${d.prop}: ${d.value}. Use a token such as var(--color-…).` });
      }
      if (!isTokenFile && d.prop === "font-size" && /\d+(\.\d+)?px\b/.test(d.value)) {
        push(d.line, { ruleId: "raw-font-size", category: "tokens", severity: "warning", message: `font-size: ${d.value} bypasses the type scale. Use a token or rem value from the scale.` });
      }
      if (d.prop === "outline" && /^(none|0)(\s*!important)?$/.test(d.value) && !props.has("box-shadow") && !props.has("border-color")) {
        push(d.line, { ruleId: "outline-none", category: "a11y", severity: "error", message: `outline: ${d.value} on "${rule.selector}" removes the focus indicator with no replacement. Keyboard users can't see where they are.` });
      }
    }
  }
  return findings;
}
