// test/unit/editor-options.test.mjs
import { test } from "node:test";
import { deepStrictEqual as eq, strictEqual } from "node:assert/strict";
import { buildOptions, resolveSelection, PRESERVE_ID } from "../../scripts/utils/editor-options.js";

const presets = [
  { id: "heavy-pistol", itemName: "Heavy Pistol", packName: "core_weapons", damage: "3d6" },
  { id: "smg", itemName: "SMG", packName: "core_weapons", damage: "2d6" },
];

test("buildOptions marks the matching preset selected", () => {
  const { options, preserved } = buildOptions(presets, { itemName: "SMG" }, o => o.id, "label");
  strictEqual(preserved, false);
  eq(options.map(o => o.selected), [false, true]);
});

test("buildOptions appends a preserve option for an unknown item", () => {
  const cur = { itemName: "Militech Cybermastiff", packName: "core_cyberware" };
  const { options, preserved } = buildOptions(presets, cur, o => o.itemName, "itemName");
  strictEqual(preserved, true);
  strictEqual(options.length, 3);
  eq(options[2], { id: PRESERVE_ID, label: "Militech Cybermastiff", selected: true });
  eq(options.slice(0, 2).map(o => o.selected), [false, false]);
});

test("buildOptions with no current item selects nothing extra", () => {
  const { options, preserved } = buildOptions(presets, null, o => o.itemName, "itemName");
  strictEqual(preserved, false);
  strictEqual(options.length, 2);
});

test("buildOptions selects by id and preserves an unknown item when idOf = o => o.id (production shape)", () => {
  const cur = { itemName: "Militech Cybermastiff" };
  const { options, preserved } = buildOptions(presets, cur, o => o.id, "label");
  strictEqual(preserved, true);
  strictEqual(options.at(-1).id, PRESERVE_ID);
  strictEqual(options.at(-1).selected, true);
});

test("buildOptions selects matching preset by id when idOf = o => o.id", () => {
  const { options } = buildOptions(presets, { itemName: "SMG" }, o => o.id, "label");
  eq(options.map(o => o.selected), [false, true]);
});

test("buildOptions treats empty-string itemName as absent (no preserve row)", () => {
  const { options, preserved } = buildOptions(presets, { itemName: "" }, o => o.id, "label");
  strictEqual(preserved, false);
  strictEqual(options.length, 2);
});

test("resolveSelection returns the matched preset", () => {
  eq(resolveSelection("smg", presets), presets[1]);
});

test("resolveSelection returns null when no preset id matches", () => {
  strictEqual(resolveSelection("nonexistent", presets), null);
  strictEqual(resolveSelection(PRESERVE_ID, presets), null);
});
