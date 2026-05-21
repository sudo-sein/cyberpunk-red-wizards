// test/unit/editor-options-shape.test.mjs
import { test } from "node:test";
import { ok, strictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync(new URL("../../data/editor-options.json", import.meta.url), "utf8"),
);

test("editor-options.json has the four expected categories", () => {
  for (const key of ["armor", "weapons", "equipment", "cyberware"]) {
    ok(Array.isArray(catalog[key]), `${key} should be an array`);
    ok(catalog[key].length > 0, `${key} should be non-empty`);
  }
});

test("armor entries have required keys", () => {
  for (const a of catalog.armor) {
    strictEqual(typeof a.name, "string");
    strictEqual(typeof a.sp, "number");
    strictEqual(a.packName, "core_armor");
    ok("headItem" in a && "bodyItem" in a);
  }
});

test("weapon entries have itemName + core_weapons packName", () => {
  for (const w of catalog.weapons) {
    ok(w.itemName && typeof w.itemName === "string");
    strictEqual(w.packName, "core_weapons");
    ok(!/\((Poor|Excellent)\)\s*$/.test(w.itemName), `${w.itemName} should not be a quality variant`);
  }
});

test("equipment + cyberware entries have itemName + packName", () => {
  for (const e of [...catalog.equipment, ...catalog.cyberware]) {
    ok(e.itemName && typeof e.itemName === "string");
    ok(e.packName && typeof e.packName === "string");
  }
});

test("cyberware entries all live in core_cyberware", () => {
  for (const c of catalog.cyberware) strictEqual(c.packName, "core_cyberware");
});
