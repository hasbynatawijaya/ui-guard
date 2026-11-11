import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactRanges } from "./claude.js";
import { globToRegExp } from "./config.js";
import { isChanged, parseUnifiedDiff } from "./diff.js";

const diff = `diff --git a/src/A.tsx b/src/A.tsx
index 1..2 100644
--- a/src/A.tsx
+++ b/src/A.tsx
@@ -3,0 +4,2 @@ export
+  <img src="x" />
+  <p>hi</p>
@@ -10 +12 @@ x
-old
+new
diff --git a/src/Gone.tsx b/src/Gone.tsx
--- a/src/Gone.tsx
+++ b/src/Gone.tsx
@@ -1,2 +0,0 @@
-a
-b
diff --git a/src/New.css b/src/New.css
new file mode 100644
--- /dev/null
+++ b/src/New.css
@@ -0,0 +1,3 @@
+.a {
+}
+`;

describe("parseUnifiedDiff", () => {
  it("collects added and modified lines per file", () => {
    const changed = parseUnifiedDiff(diff);
    assert.deepEqual([...changed.get("src/A.tsx")!], [4, 5, 12]);
    assert.deepEqual([...changed.get("src/New.css")!], [1, 2, 3]);
  });

  it("drops files that only lost lines", () => {
    assert.equal(parseUnifiedDiff(diff).has("src/Gone.tsx"), false);
  });

  it("answers whether a line changed", () => {
    const changed = parseUnifiedDiff(diff);
    assert.equal(isChanged(changed, "src/A.tsx", 4), true);
    assert.equal(isChanged(changed, "src/A.tsx", 6), false);
    assert.equal(isChanged(changed, "src/Other.tsx", 1), false);
  });
});

describe("helpers", () => {
  it("matches globs", () => {
    assert.equal(globToRegExp("**/tokens.css").test("tokens.css"), true);
    assert.equal(globToRegExp("**/tokens.css").test("src/styles/tokens.css"), true);
    assert.equal(globToRegExp("src/*.css").test("src/a/b.css"), false);
  });

  it("compacts line ranges", () => {
    assert.equal(compactRanges([5, 1, 2, 3, 9, 10]), "1-3,5,9-10");
  });
});
