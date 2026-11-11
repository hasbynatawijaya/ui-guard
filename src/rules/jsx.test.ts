import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkJsx } from "./jsx.js";

const ids = (src: string) => checkJsx("C.tsx", src).map((f) => `${f.ruleId}@${f.line}`);

describe("jsx rules", () => {
  it("flags <img> without alt and without size", () => {
    assert.deepEqual(ids(`const A = () => <img src="a.png" />;`), ["img-alt@1", "img-dimensions@1"]);
    assert.deepEqual(ids(`const A = () => <img src="a.png" alt="" width={10} height={10} />;`), []);
  });

  it("flags a clickable div with no keyboard support", () => {
    assert.deepEqual(ids(`const A = () => <div onClick={go}>Open</div>;`), ["click-on-static@1"]);
    assert.deepEqual(ids(`const A = () => <div role="button" tabIndex={0} onClick={go} onKeyDown={key}>Open</div>;`), []);
  });

  it("flags icon-only buttons without a name", () => {
    assert.deepEqual(ids(`const A = () => <button onClick={x}><TrashIcon /></button>;`), ["button-name@1"]);
    assert.deepEqual(ids(`const A = () => <button aria-label="Delete"><TrashIcon /></button>;`), []);
    assert.deepEqual(ids(`const A = () => <button><TrashIcon /> Delete</button>;`), []);
    assert.deepEqual(ids(`const A = () => <button>{label}</button>;`), []);
  });

  it("flags inputs without a label, and mentions placeholders", () => {
    const found = checkJsx("C.tsx", `const A = () => <input placeholder="Email" />;`);
    assert.equal(found[0]?.ruleId, "input-label");
    assert.match(found[0]!.message, /placeholder is not a label/);
    assert.deepEqual(ids(`const A = () => <label>Email <input /></label>;`), []);
    assert.deepEqual(ids(`const A = () => <><label htmlFor="e">Email</label><input id="e" /></>;`), []);
    assert.deepEqual(ids(`const A = () => <input type="hidden" name="t" />;`), []);
  });

  it("stays quiet when props are spread, since it can't see them", () => {
    assert.deepEqual(ids(`const A = (p) => <input {...p} />;`), []);
  });

  it("flags anchors used as buttons, positive tabIndex and autoFocus", () => {
    assert.deepEqual(ids(`const A = () => <a onClick={go}>Go</a>;`), ["anchor-button@1"]);
    assert.deepEqual(ids(`const A = () => <span tabIndex={3}>x</span>;`), ["tabindex-positive@1"]);
    assert.deepEqual(ids(`const A = () => <input aria-label="q" autoFocus />;`), ["no-autofocus@1"]);
  });

  it("flags raw colours and font sizes in inline styles", () => {
    assert.deepEqual(
      ids(`const A = () => <p style={{ color: "#ff0000", fontSize: 13, margin: 4 }}>x</p>;`),
      ["raw-color@1", "raw-font-size@1"],
    );
    assert.deepEqual(ids(`const A = () => <p style={{ color: "var(--text)" }}>x</p>;`), []);
  });

  it("flags Tailwind arbitrary values that bypass tokens", () => {
    assert.deepEqual(ids(`const A = () => <p className="text-[#333] mt-4">x</p>;`), ["arbitrary-value@1"]);
    assert.deepEqual(ids(`const A = () => <p className="text-gray-700 w-[50%]">x</p>;`), []);
    assert.deepEqual(ids(`const A = () => <a className={on ? "text-[#2563eb]" : "text-gray-600"}>x</a>;`), ["arbitrary-value@1"]);
    assert.deepEqual(ids("const A = () => <p className={`p-4 ${big ? \"text-[18px]\" : \"\"}`}>x</p>;"), ["arbitrary-value@1"]);
  });

  it("flags the map index used as key, not other keys", () => {
    const src = `const L = ({ items }) => (
  <ul>
    {items.map((item, index) => <li key={index}>{item.name}</li>)}
    {items.map((item) => <li key={item.id}>{item.name}</li>)}
  </ul>
);`;
    assert.deepEqual(ids(src), ["index-key@3"]);
  });

  it("flags whole-library imports of lodash and moment", () => {
    assert.deepEqual(ids(`import _ from "lodash";\nimport { debounce } from "lodash";\nimport moment from "moment";\nimport debounce2 from "lodash/debounce";`), [
      "heavy-import@1",
      "heavy-import@2",
      "heavy-import@3",
    ]);
  });
});
