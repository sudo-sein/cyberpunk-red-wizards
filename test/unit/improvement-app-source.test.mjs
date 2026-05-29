import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../scripts/app/improvement-app.js", import.meta.url), "utf8");

test("ImprovementApp uses persisted category open state instead of cart deltas", () => {
  assert.match(source, /import \{ categoryIsOpen \} from "\.\.\/improvement\/category-open-state\.js";/);
  assert.match(source, /#categoryOpenStates = new Map\(\);/);
  assert.match(source, /const filter = this\.#filterValue\.trim\(\)\.toLowerCase\(\);/);
  assert.match(source, /querySelectorAll\("\.crw-improvement-category"\)/);
  assert.match(source, /const hasFilter = this\.#filterValue\.trim\(\)\.length > 0;/);
  assert.match(source, /if \(!key \|\| hasFilter\) return;/);
  assert.match(source, /#categoryOpenStates\.set\(key, event\.currentTarget\.open\)/);
  assert.match(source, /open: categoryIsOpen\(\{ key, filterValue: this\.#filterValue, openStates: this\.#categoryOpenStates \}\)/);
  assert.doesNotMatch(source, /open: rows\.some\(\(r\) => r\.delta > 0\) \|\| !!filter/);
});
