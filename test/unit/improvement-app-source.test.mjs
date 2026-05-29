import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../scripts/app/improvement-app.js", import.meta.url), "utf8");
const en = await readFile(new URL("../../languages/en.json", import.meta.url), "utf8");
const pl = await readFile(new URL("../../languages/pl.json", import.meta.url), "utf8");

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

test("ImprovementApp opens with an actor-specific ApplicationV2 id", () => {
  assert.match(source, /new ImprovementApp\(\{ actor: target, id: `crw-improvement-\$\{target\.id\}` \}\)/);
  assert.match(source, /ImprovementApp\.instances\.set\(target\.id, app\)/);
});

test("ImprovementApp imports and announces improvement presence open and close", () => {
  assert.match(
    source,
    /import \{ announceImprovementOpen, announceImprovementClose, IMPROVEMENT_PRESENCE_HOOK \} from "\.\.\/improvement\/improvement-presence\.js";/,
  );
  assert.match(source, /announceImprovementOpen\(target\.id\)/);
  assert.match(source, /announceImprovementClose\(this\.#actor\.id\)/);
});

test("ImprovementApp registers actor, item, and presence hooks", () => {
  for (const hookName of [
    "updateActor",
    "createItem",
    "updateItem",
    "deleteItem",
    "IMPROVEMENT_PRESENCE_HOOK",
  ]) {
    assert.match(source, new RegExp(`Hooks\\.on\\(${hookName === "IMPROVEMENT_PRESENCE_HOOK" ? hookName : `"${hookName}"`}`));
  }
  assert.match(source, /#isItemForActor\(item\)/);
  assert.match(source, /payload\.actorId !== this\.#actor\.id/);
  assert.match(source, /payload\.userId === game\.user\.id/);
  assert.match(source, /payload\.state !== "open"/);
  assert.match(source, /crw\.improvement\.errors\.concurrentEditor/);
});

test("ImprovementApp stores hook ids in a collection and unregisters them", () => {
  assert.match(source, /#hookIds = \[\];/);
  assert.doesNotMatch(source, /#updateHookId/);
  assert.match(source, /this\.#hookIds\.push\(\{[\s\S]*hook: "updateActor",[\s\S]*id:/);
  assert.match(source, /for \(const \{ hook, id \} of this\.#hookIds\)/);
  assert.match(source, /Hooks\.off\(hook, id\)/);
  assert.match(source, /this\.#hookIds = \[\];/);
});

test("ImprovementApp ignores external stale-state hooks while applying", () => {
  assert.match(source, /#onExternalActorChanged\(changed\) \{/);
  assert.match(source, /#onExternalItemChanged\(item\) \{/);
  assert.match(source, /if \(this\.#isApplying\) return;/);
  assert.match(source, /crw\.improvement\.errors\.actorChanged/);
  assert.match(source, /this\.#clampCartToCurrentActor\(\);/);
});

test("ImprovementApp clamps stale cart entries against current caps and duplicate new roles", () => {
  assert.match(source, /const MAX_LEVEL = 10;/);
  assert.match(source, /const maxDelta = Math\.max\(0, MAX_LEVEL - \(item\.system\.level \?\? 0\)\)/);
  assert.match(source, /const maxDelta = Math\.max\(0, MAX_LEVEL - \(item\.system\.rank \?\? 0\)\)/);
  assert.match(source, /#actorHasRole\(\{ packId, sourceId, name \}\) \{/);
  assert.match(source, /item\.getFlag\?\.\("core", "sourceId"\) === sourceUuid/);
  assert.match(source, /item\.name === name/);
  assert.match(source, /if \(this\.#actorHasRole\(entry\)\) this\.#cart\.newRoles\.delete\(syntheticId\)/);
});

test("ImprovementApp maps newly added commit errors to localized keys", () => {
  assert.match(source, /case "INVALID_CART":/);
  assert.match(source, /crw\.improvement\.errors\.invalidCart/);
  assert.match(source, /case "INVALID_ROLE_SOURCE":/);
  assert.match(source, /crw\.improvement\.errors\.invalidRoleSource/);
  assert.match(source, /case "DUPLICATE_ROLE":/);
  assert.match(source, /crw\.improvement\.errors\.duplicateRole/);
});

test("ImprovementApp closes after successful apply without rendering the window again", () => {
  assert.match(source, /let shouldRenderAfterApply = true;/);
  assert.match(source, /shouldRenderAfterApply = false;\s*this\.close\(\);/);
  assert.match(source, /if \(shouldRenderAfterApply && this\.element\) this\.render\(true\);/);
});

test("ImprovementApp stale-state and commit error keys are localized", () => {
  for (const locale of [en, pl]) {
    for (const key of [
      "crw.improvement.errors.actorChanged",
      "crw.improvement.errors.concurrentEditor",
      "crw.improvement.errors.invalidCart",
      "crw.improvement.errors.invalidRoleSource",
      "crw.improvement.errors.duplicateRole",
    ]) {
      assert.match(locale, new RegExp(`"${key}":`));
    }
  }
});
