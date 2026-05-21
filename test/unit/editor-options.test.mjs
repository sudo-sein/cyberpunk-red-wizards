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

test("resolveSelection returns the matched preset", () => {
  eq(resolveSelection("smg", presets, { itemName: "SMG" }), presets[1]);
});

test("resolveSelection returns the original object for the preserve id", () => {
  const cur = { itemName: "Militech Cybermastiff", packName: "core_cyberware" };
  eq(resolveSelection(PRESERVE_ID, presets, cur), cur);
});

test("resolveSelection returns null when nothing matches and no current", () => {
  strictEqual(resolveSelection("nonexistent", presets, null), null);
});
