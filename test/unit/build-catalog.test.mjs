// test/unit/build-catalog.test.mjs
import { test } from "node:test";
import { deepStrictEqual as eq } from "node:assert/strict";
import { buildCatalog } from "../../tools/build-catalog.mjs";

const packs = {
  "core/weapons": [
    { name: "Heavy Pistol", type: "weapon", damage: "3d6" },
    { name: "Heavy Pistol (Poor)", type: "weapon", damage: "3d6" },
    { name: "Heavy Pistol (Excellent)", type: "weapon", damage: "3d6" },
    { name: "Assault Rifle", type: "weapon", damage: "5d6" },
  ],
  "core/armor": [
    { name: "Leathers (Head)", type: "armor", headSp: 4, bodySp: 0 },
    { name: "Leathers (Body)", type: "armor", headSp: 0, bodySp: 4 },
    { name: "Bodyweight Suit", type: "armor", headSp: 11, bodySp: 11 },
    { name: "Bullet Proof Shield", type: "armor", isShield: true, headSp: 0, bodySp: 0 },
  ],
  "core/cyberware": [
    { name: "Sandevistan", type: "cyberware" },
    { name: "Rippers", type: "cyberware" },
  ],
  "core/gear": [{ name: "Flashlight", type: "gear" }],
  "core/drugs": [{ name: "Synthcoke", type: "drug" }],
  "core/ammo": [{ name: "Grenade (Smoke)", type: "ammo" }],
};

test("buildCatalog excludes weapon quality variants and keeps base names", () => {
  const { weapons } = buildCatalog(packs);
  eq(weapons, [
    { itemName: "Assault Rifle", packName: "core_weapons", damage: "5d6" },
    { itemName: "Heavy Pistol", packName: "core_weapons", damage: "3d6" },
  ]);
});

test("buildCatalog pairs head/body armor and routes shields/body-only out", () => {
  const { armor } = buildCatalog(packs);
  eq(armor, [
    { name: "Leathers", sp: 4, packName: "core_armor", headItem: "Leathers (Head)", bodyItem: "Leathers (Body)" },
  ]);
});

test("buildCatalog folds gear+drugs+ammo+unpaired-armor into equipment, sorted", () => {
  const { equipment } = buildCatalog(packs);
  eq(equipment, [
    { itemName: "Bodyweight Suit", packName: "core_armor" },
    { itemName: "Bullet Proof Shield", packName: "core_armor" },
    { itemName: "Flashlight", packName: "core_gear" },
    { itemName: "Grenade (Smoke)", packName: "core_ammo" },
    { itemName: "Synthcoke", packName: "core_drugs" },
  ]);
});

test("buildCatalog maps cyberware (incl. cyberweapons), sorted", () => {
  const { cyberware } = buildCatalog(packs);
  eq(cyberware, [
    { itemName: "Rippers", packName: "core_cyberware" },
    { itemName: "Sandevistan", packName: "core_cyberware" },
  ]);
});
