import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../../styles/improvement.css", import.meta.url), "utf8");

test("improvement rows reserve visible space for names", () => {
  assert.match(
    css,
    /grid-template-columns:\s*minmax\(8rem,\s*1fr\)/,
    "row grid should not allow the name column to collapse to zero",
  );
});

test("improvement role rows use compact layout in the narrow role panel", () => {
  assert.match(css, /\.crw-improvement-roles\s+\.crw-improvement-row\s*\{/);
  assert.match(css, /grid-template-areas:\s*\n\s*"name controls"\s*\n\s*"value cost"/);
});
