import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkCss, parseCss } from "./css.js";

describe("css parser", () => {
  it("keeps line numbers through comments and nested blocks", () => {
    const rules = parseCss(`/* a
comment */
.a {
  color: red;
}
@media (min-width: 600px) {
  .b { margin: 0; padding: 4px }
}`);
    const a = rules.find((r) => r.selector === ".a");
    const b = rules.find((r) => r.selector === ".b");
    assert.equal(a?.declarations[0]?.line, 4);
    assert.deepEqual(b?.declarations.map((d) => [d.prop, d.line]), [["margin", 7], ["padding", 7]]);
  });
});

describe("css rules", () => {
  it("flags raw colours but not token definitions or var() use", () => {
    const found = checkCss("a.css", `:root { --brand: #0055ff; }\n.btn { background: #0055ff; color: var(--brand); }`, false);
    assert.deepEqual(found.map((f) => `${f.ruleId}@${f.line}`), ["raw-color@2"]);
  });

  it("allows raw values in token files", () => {
    assert.deepEqual(checkCss("tokens.css", `.x { color: #111; font-size: 14px; }`, true), []);
  });

  it("flags px font sizes", () => {
    assert.deepEqual(checkCss("a.css", `.t { font-size: 13px; }`, false).map((f) => f.ruleId), ["raw-font-size"]);
    assert.deepEqual(checkCss("a.css", `.t { font-size: var(--text-sm); }`, false), []);
  });

  it("flags outline: none unless the rule replaces it", () => {
    assert.deepEqual(checkCss("a.css", `button:focus { outline: none; }`, false).map((f) => f.ruleId), ["outline-none"]);
    assert.deepEqual(checkCss("a.css", `button:focus { outline: 0; box-shadow: 0 0 0 3px var(--focus); }`, false), []);
  });
});
