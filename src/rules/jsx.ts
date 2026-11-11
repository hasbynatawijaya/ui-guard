import ts from "typescript";
import type { Finding } from "../types.js";

// Deterministic checks for JSX/TSX. Each rule looks at one element at a time.
// When an element spreads props ({...props}) the rule can't see every
// attribute, so it stays quiet instead of guessing.

type Emit = (node: ts.Node, finding: Omit<Finding, "file" | "line" | "source">) => void;

const STATIC_ELEMENTS = new Set(["div", "span", "li", "p", "section", "article", "td", "tr", "img", "header", "footer", "main", "nav"]);
const COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;
const HEAVY_IMPORTS = new Map([
  ["lodash", "Import the single function (lodash/debounce) or use lodash-es so unused code is dropped."],
  ["moment", "moment is large and not tree-shakable; use date-fns, dayjs or Intl."],
]);

export function checkJsx(file: string, source: string): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings: Finding[] = [];
  const emit: Emit = (node, f) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    findings.push({ ...f, file, line, source: "rules" });
  };
  const labelTargets = collectLabelTargets(sf);

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) checkImport(node, emit);
    if (ts.isJsxElement(node)) checkElement(node.openingElement, node, emit, labelTargets);
    if (ts.isJsxSelfClosingElement(node)) checkElement(node, null, emit, labelTargets);
    if (ts.isJsxAttribute(node)) checkAttribute(node, emit);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function tagName(el: Opening): string {
  return el.tagName.getText();
}

function attrs(el: Opening) {
  const map = new Map<string, ts.JsxAttribute>();
  let spread = false;
  for (const prop of el.attributes.properties) {
    if (ts.isJsxSpreadAttribute(prop)) spread = true;
    else map.set(prop.name.getText(), prop);
  }
  return { map, spread };
}

// Literal string value of an attribute, or undefined when it's an expression.
function stringValue(attr: ts.JsxAttribute | undefined): string | undefined {
  if (!attr?.initializer) return undefined;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isStringLiteralLike(attr.initializer.expression)) {
    return attr.initializer.expression.text;
  }
  return undefined;
}

function checkElement(el: Opening, full: ts.JsxElement | null, emit: Emit, labelTargets: Set<string>) {
  const tag = tagName(el);
  const { map, spread } = attrs(el);
  if (spread) return;

  if (tag === "img") {
    if (!map.has("alt")) {
      emit(el, { ruleId: "img-alt", category: "a11y", severity: "error", message: "<img> has no alt. Describe the image, or use alt=\"\" if it is decorative." });
    }
    if (!map.has("width") || !map.has("height")) {
      emit(el, { ruleId: "img-dimensions", category: "perf", severity: "warning", message: "<img> has no width and height, so the page jumps when it loads (layout shift)." });
    }
  }

  if (STATIC_ELEMENTS.has(tag) && map.has("onClick")) {
    const hasRole = map.has("role");
    const hasKeyboard = map.has("onKeyDown") || map.has("onKeyUp") || map.has("onKeyPress");
    const focusable = map.has("tabIndex");
    if (!hasRole || !hasKeyboard || !focusable) {
      emit(el, {
        ruleId: "click-on-static",
        category: "a11y",
        severity: "error",
        message: `<${tag} onClick> can't be reached or used with a keyboard. Use a <button>, or add role, tabIndex and a key handler.`,
      });
    }
  }

  if (tag === "a" && !map.has("href") && map.has("onClick")) {
    emit(el, { ruleId: "anchor-button", category: "a11y", severity: "warning", message: "<a> without href acts as a button. Use <button> so it is focusable and announced correctly." });
  }

  if (tag === "button" && full && !hasAccessibleName(map) && !hasText(full)) {
    emit(el, { ruleId: "button-name", category: "a11y", severity: "error", message: "This button has no text or aria-label, so screen readers announce only \"button\"." });
  }
  if (tag === "button" && !full && !hasAccessibleName(map)) {
    emit(el, { ruleId: "button-name", category: "a11y", severity: "error", message: "This button has no text or aria-label, so screen readers announce only \"button\"." });
  }

  if (tag === "input" || tag === "select" || tag === "textarea") {
    const type = stringValue(map.get("type"));
    if (type === "hidden" || type === "submit" || type === "button" || type === "reset") return;
    const id = stringValue(map.get("id"));
    const labelled = hasAccessibleName(map) || (id !== undefined && labelTargets.has(id)) || insideLabel(el);
    if (!labelled) {
      const hint = map.has("placeholder") ? " A placeholder is not a label." : "";
      emit(el, { ruleId: "input-label", category: "a11y", severity: "error", message: `<${tag}> has no label.${hint} Wrap it in <label>, point a <label htmlFor> at its id, or add aria-label.` });
    }
  }
}

function checkAttribute(attr: ts.JsxAttribute, emit: Emit) {
  const name = attr.name.getText();
  const init = attr.initializer;

  if (name === "autoFocus") {
    emit(attr, { ruleId: "no-autofocus", category: "a11y", severity: "warning", message: "autoFocus moves focus without warning, which disorients screen reader and keyboard users." });
  }

  if (name === "tabIndex" && init && ts.isJsxExpression(init) && init.expression) {
    const value = Number(init.expression.getText());
    if (value > 0) {
      emit(attr, { ruleId: "tabindex-positive", category: "a11y", severity: "warning", message: `tabIndex={${value}} changes the natural tab order. Use 0 or -1.` });
    }
  }

  if (name === "style" && init && ts.isJsxExpression(init) && init.expression && ts.isObjectLiteralExpression(init.expression)) {
    for (const prop of init.expression.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = prop.name.getText().replace(/['"]/g, "");
      const value = prop.initializer;
      if (ts.isStringLiteralLike(value) && COLOR.test(value.text)) {
        emit(prop, { ruleId: "raw-color", category: "tokens", severity: "warning", message: `Hard-coded colour "${value.text}" in style.${key}. Use a design token (CSS variable or theme value).` });
      }
      if (key === "fontSize" && (ts.isNumericLiteral(value) || (ts.isStringLiteralLike(value) && /px$/.test(value.text)))) {
        emit(prop, { ruleId: "raw-font-size", category: "tokens", severity: "warning", message: `Hard-coded font size ${value.getText()}. Use the type scale token.` });
      }
    }
  }

  if (name === "className" && init) {
    // Read every string in the expression, so cond ? "a" : "b", template
    // literals and clsx("a", cond && "b") are all covered.
    const text = stringsIn(init).join(" ");
    const arbitrary = text.match(/\b[\w:-]+-\[(?:#[0-9a-fA-F]{3,8}|\d+(?:\.\d+)?px|rgba?\([^\]]*\))\]/g);
    if (arbitrary) {
      emit(attr, { ruleId: "arbitrary-value", category: "tokens", severity: "warning", message: `Arbitrary value ${arbitrary.join(", ")} bypasses the design tokens. Use a theme class.` });
    }
  }

  if (name === "key" && init && ts.isJsxExpression(init) && init.expression && ts.isIdentifier(init.expression)) {
    if (isMapIndex(init.expression)) {
      emit(attr, { ruleId: "index-key", category: "perf", severity: "warning", message: `key={${init.expression.text}} uses the array index. Reordering or removing items re-renders the wrong rows; use a stable id.` });
    }
  }
}

function checkImport(node: ts.ImportDeclaration, emit: Emit) {
  const module = (node.moduleSpecifier as ts.StringLiteral).text;
  const advice = HEAVY_IMPORTS.get(module);
  const clause = node.importClause;
  if (!advice || !clause) return;
  // `import { debounce } from "lodash"` still pulls all of lodash (CommonJS).
  const whole = clause.name !== undefined || (clause.namedBindings !== undefined && (ts.isNamespaceImport(clause.namedBindings) || module === "lodash"));
  if (whole) {
    emit(node, { ruleId: "heavy-import", category: "perf", severity: "warning", message: `Importing "${module}" ships the whole library. ${advice}` });
  }
}

// True when `id` is the second parameter of a callback passed to `.map(...)`.
function isMapIndex(id: ts.Identifier): boolean {
  let node: ts.Node | undefined = id.parent;
  while (node) {
    if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isCallExpression(node.parent)) {
      const call = node.parent;
      const isMap = ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "map";
      const index = node.parameters[1];
      if (isMap && index && ts.isIdentifier(index.name) && index.name.text === id.text) return true;
    }
    node = node.parent;
  }
  return false;
}

function stringsIn(node: ts.Node): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.flatMap((span) => [...stringsIn(span.expression), span.literal.text])];
  const out: string[] = [];
  ts.forEachChild(node, (child) => {
    out.push(...stringsIn(child));
  });
  return out;
}

function hasAccessibleName(map: Map<string, ts.JsxAttribute>): boolean {
  return map.has("aria-label") || map.has("aria-labelledby") || map.has("title");
}

// Any text child, or any {expression} child (assumed to render text).
function hasText(el: ts.JsxElement): boolean {
  for (const child of el.children) {
    if (ts.isJsxText(child) && child.text.trim() !== "") return true;
    if (ts.isJsxExpression(child) && child.expression) return true;
    if (ts.isJsxElement(child) && hasText(child)) return true;
  }
  return false;
}

function insideLabel(el: Opening): boolean {
  let node: ts.Node | undefined = el.parent;
  while (node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === "label") return true;
    node = node.parent;
  }
  return false;
}

// ids that some <label htmlFor="..."> in this file points at.
function collectLabelTargets(sf: ts.SourceFile): Set<string> {
  const ids = new Set<string>();
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === "label") {
      for (const prop of node.attributes.properties) {
        if (ts.isJsxAttribute(prop) && prop.name.getText() === "htmlFor") {
          const value = stringValue(prop);
          if (value) ids.add(value);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return ids;
}
