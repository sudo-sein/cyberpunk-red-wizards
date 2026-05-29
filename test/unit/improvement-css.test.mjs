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
  assert.match(css, /grid-template-areas:\s*\n\s*"name controls"\s*\n\s*"value controls"\s*\n\s*"planned next"/);
});

test("improvement rows keep planned and next cost slots stable", () => {
  assert.match(css, /crw-improvement-row-planned/, "planned cost slot should have CSS");
  assert.match(css, /crw-improvement-row-next/, "next cost slot should have CSS");
  assert.match(css, /"name value planned next controls"/, "wide rows should define stable cost areas");
  assert.match(css, /"value planned next controls"/, "compact rows should keep stable cost areas");
  assert.match(
    css,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(7rem,\s*auto\)\s+minmax\(5\.5rem,\s*auto\)\s+auto/,
    "compact rows should reserve planned and next cost widths",
  );
  assert.match(
    css,
    /@media \(max-width: 900px\)[\s\S]*\.crw-improvement-roles\s+\.crw-improvement-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(7rem,\s*auto\)\s+minmax\(5\.5rem,\s*auto\)\s+auto/,
    "compact role rows should reserve planned and next cost widths despite role-specific grid overrides",
  );
});
