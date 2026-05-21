// test/unit/editor-catalog.test.mjs
import { test } from "node:test";
import { deepStrictEqual as eq, strictEqual } from "node:assert/strict";
import { slugify, shapeCatalog, flattenSkills } from "../../scripts/data/editor-catalog.js";

test("slugify lowercases and hyphenates", () => {
  strictEqual(slugify("Heavy Pistol"), "heavy-pistol");
  strictEqual(slugify("Grenade (Smoke)"), "grenade-smoke");
  strictEqual(slugify("Slice 'N Dice"), "slice-n-dice");
});

test("shapeCatalog prepends a none armor option and adds ids", () => {
  const raw = {
    armor: [{ name: "Leathers", sp: 4, packName: "core_armor", headItem: "Leathers (Head)", bodyItem: "Leathers (Body)" }],
    weapons: [{ itemName: "Heavy Pistol", packName: "core_weapons", damage: "3d6" }],
    equipment: [{ itemName: "Grenade (Smoke)", packName: "core_ammo" }],
    cyberware: [{ itemName: "Sandevistan", packName: "core_cyberware" }],
  };
  const c = shapeCatalog(raw);
  strictEqual(c.armor[0].id, "none");
  eq(c.armor[1], { id: "leathers", name: "Leathers", sp: 4, packName: "core_armor", headItem: "Leathers (Head)", bodyItem: "Leathers (Body)" });
  eq(c.weapons[0], { id: "heavy-pistol", itemName: "Heavy Pistol", packName: "core_weapons", damage: "3d6" });
  eq(c.equipment[0], { id: "grenade-smoke", itemName: "Grenade (Smoke)", packName: "core_ammo" });
  eq(c.cyberware[0], { id: "sandevistan", itemName: "Sandevistan", packName: "core_cyberware" });
});

test("shapeCatalog de-duplicates colliding ids within a category", () => {
  const raw = {
    armor: [],
    weapons: [],
    equipment: [
      { itemName: "Battery Pack", packName: "core_ammo" },
      { itemName: "Battery-Pack", packName: "core_gear" },
    ],
    cyberware: [],
  };
  const ids = shapeCatalog(raw).equipment.map((e) => e.id);
  eq(ids, ["battery-pack", "battery-pack-2"]);
});

test("flattenSkills flattens groups to unique sorted names", () => {
  const all = {
    awarenessSkills: [{ name: "Perception" }, { name: "Concentration" }],
    bodySkills: [{ name: "Athletics" }, { name: "Perception" }],
  };
  eq(flattenSkills(all), ["Athletics", "Concentration", "Perception"]);
});
