import { test } from "node:test";
import { deepStrictEqual as eq } from "node:assert/strict";
import {
  parseStats, parseVitals, parseArmor, parseWeapons, parseSkills, parseEquipment, parseRoleAbility,
} from "../../scripts/import/parse-sections.js";

const map = {
  labels: { armorKeyword: "Armor:", headSp: "Head\\s+(\\d+)\\s*SP", bodySp: "Body\\s+(\\d+)\\s*SP" },
  sectionHeaders: { skills: "▶ Skill Bases", roleAbility: "▶ Role Ability", equipment: "▶ Cyberware & Special Equipment" },
  qualityPrefixes: { "Poor Quality": "poor" },
  weapons: { "Assault Rifle": "Assault Rifle", "Very Heavy Pistol": "Very Heavy Pistol", "Medium Melee Weapon": "Medium Melee", "Heavy SMG": "Heavy SMG", "Wolvers": "Wolvers" },
  cyberwareWeapons: ["Wolvers", "Popup Grenade Launcher", "Cybersnake"],
  weaponUpgrades: { "Underbarrel Shotgun": { packName: "core_upgrades", itemName: "Shotgun Underbarrel" } },
  popupWeapons: { "Popup Heavy SMG": { weapon: "Heavy SMG", mount: "Popup Ranged Weapon" } },
  roleAbilities: { "Combat Awareness": "Solo" },
  skills: { "Athletics": "Athletics", "Heavy Weapons": "Heavy Weapons", "Tracking": "Tracking", "Local Expert": "Local Expert" },
  armor: {
    "M Armorjack": { head: "Medium Armorjack (Head)", body: "Medium Armorjack (Body)", sp: 13 },
    "Subdermal": { sp: 11, cyberware: "Subdermal Armor" },
    "Kevlar": { head: "Kevlar® (Head)", body: "Kevlar® (Body)", sp: 7 },
  },
  ammo: {},
  equipment: { "Cyberarm": { packName: "core_cyberware", itemName: "Cyberarm" } },
};

test("parseStats left-fills missing second-line values with 0 + warning", () => {
  const { stats, warnings } = parseStats([
    "▶ INT ▶ REF ▶ DEX ▶ TECH ▶ COOL 4 8 (6) 6 (4) 4 6",
    "5 — 7 4",
  ]);
  eq(stats, { int: 4, ref: 8, dex: 6, tech: 4, cool: 6, will: 5, luck: 0, move: 7, body: 4, emp: 0 });
  eq(warnings.length >= 1, true);
});

test("parseVitals", () => {
  eq(parseVitals(["▶ Hit Points ▶ Seriously Wounded ▶ Death Save 55 28 10"]),
     { hp: 55, seriousWound: 28, deathSave: 10 });
});

test("parseArmor mapped armor", () => {
  const a = parseArmor([["Armor: M Armorjack", "Head 13 SP", "Body 13 SP"]], map);
  eq(a.head, { name: "M Armorjack", sp: 13, packName: "core_armor", itemName: "Medium Armorjack (Head)" });
  eq(a.body, { name: "M Armorjack", sp: 13, packName: "core_armor", itemName: "Medium Armorjack (Body)" });
});

test("parseArmor cyberware-SP armor has no packName", () => {
  const a = parseArmor([["Armor: Subdermal", "Head 11 SP", "Body 11 SP"]], map);
  eq(a.head, { name: "Subdermal", sp: 11 });
  eq(a.body, { name: "Subdermal", sp: 11 });
});

test("parseArmor slices the name after an alternate armor keyword (PL)", () => {
  const plMap = {
    labels: {
      armorKeyword: "Pancerz:", armorKeywords: ["Pancerz:", "Armor:"],
      headSp: "Głowa\\s+OB\\s+(\\d+)", bodySp: "Ciało\\s+OB\\s+(\\d+)",
    },
    armor: { "Śr. kurtka kuloodp.": { head: "Medium Armorjack (Head)", body: "Medium Armorjack (Body)", sp: 12 } },
  };
  const a = parseArmor([["Armor: Śr. kurtka kuloodp.", "Głowa OB 12", "Ciało OB 12"]], plMap);
  eq(a.head, { name: "Śr. kurtka kuloodp.", sp: 12, packName: "core_armor", itemName: "Medium Armorjack (Head)" });
  eq(a.body, { name: "Śr. kurtka kuloodp.", sp: 12, packName: "core_armor", itemName: "Medium Armorjack (Body)" });
});

test("parseWeapons joins wrapped names and routes cyberweapons", () => {
  const r = parseWeapons([[
    "Assault Rifle 5d6 Medium Melee", "Weapon 2d6", "Very Heavy Pistol 4d6",
  ]], map);
  eq(r.weapons, [
    { packName: "core_weapons", itemName: "Assault Rifle", quality: "standard", damage: "5d6" },
    { packName: "core_weapons", itemName: "Medium Melee", quality: "standard", damage: "2d6" },
    { packName: "core_weapons", itemName: "Very Heavy Pistol", quality: "standard", damage: "4d6" },
  ]);
  eq(r.cyberware, []);
});

test("parseWeapons popup + cyberweapons", () => {
  const r = parseWeapons([[
    "Popup Grenade Launcher 6d6 Cybersnake 4d6", "Popup Heavy SMG 3d6 Wolvers 3d6",
  ]], map);
  eq(r.weapons, [{ packName: "core_weapons", itemName: "Heavy SMG", quality: "standard", damage: "3d6" }]);
  eq(r.cyberware.map(c => c.itemName),
     ["Popup Grenade Launcher", "Cybersnake", "Popup Ranged Weapon", "Wolvers"]);
});

test("parseWeapons routes weapon upgrade out of weapons into equipment", () => {
  const r = parseWeapons([["Assault Rifle 5d6 Underbarrel Shotgun 3d6"]], map);
  eq(r.weapons, [{ packName: "core_weapons", itemName: "Assault Rifle", quality: "standard", damage: "5d6" }]);
  eq(r.equipment, [{ packName: "core_upgrades", itemName: "Shotgun Underbarrel", quantity: 1 }]);
});

test("parseSkills extracts role ability and drops it from skills", () => {
  const r = parseSkills(["▶ Skill Bases Combat Awareness 4, Athletics 11, Heavy Weapons 14, Tracking 10"], map);
  eq(r.role, { packName: "core_roles", itemName: "Solo", rank: 4 });
  eq(r.skills, [
    { name: "Athletics", base: 11 }, { name: "Heavy Weapons", base: 14 }, { name: "Tracking", base: 10 },
  ]);
});

test("parseRoleAbility maps ability line to role with rank from level", () => {
  eq(parseRoleAbility(["▶ Role Ability Combat Awareness 6"], map),
     { packName: "core_roles", itemName: "Solo", rank: 6 });
});
test("parseRoleAbility returns null when section absent", () => {
  eq(parseRoleAbility([], map), null);
});

test("parseArmor strips a trailing SP-icon number from the armor name", () => {
  const a = parseArmor([["Armor: Kevlar 6", "Head 7 SP", "Body 7 SP"]], map);
  eq(a.head, { name: "Kevlar", sp: 7, packName: "core_armor", itemName: "Kevlar® (Head)" });
});
test("parseArmor resolves a ® armor name case-insensitively", () => {
  const a = parseArmor([["Armor: Kevlar®", "Head 7 SP", "Body 7 SP"]], map);
  eq(a.head, { name: "Kevlar®", sp: 7, packName: "core_armor", itemName: "Kevlar® (Head)" });
  eq(a.body, { name: "Kevlar®", sp: 7, packName: "core_armor", itemName: "Kevlar® (Body)" });
});
test("parseSkills strips an OCR-cased Skill Bases header", () => {
  const r = parseSkills(["▶ skill bAses Athletics 11, Heavy Weapons 14"], map);
  eq(r.skills, [{ name: "Athletics", base: 11 }, { name: "Heavy Weapons", base: 14 }]);
});

test("parseStats splits a single inline stat line of 10 numbers 5/5", () => {
  const { stats } = parseStats(["int ▶ ReF ▶ Dex ▶ teCh ▶ Cool 3 6 5 2 4 4 — 4 6 3"]);
  eq(stats, { int: 3, ref: 6, dex: 5, tech: 2, cool: 4, will: 4, luck: 0, move: 4, body: 6, emp: 3 });
});

test("parseEquipment routes cyberware vs gear and ignores cyberware quantity", () => {
  const r = parseEquipment(["▶ Cyberware & Special Equipment Cyberarm x2"], map);
  eq(r.cyberware, [{ packName: "core_cyberware", itemName: "Cyberarm" }]);
  eq(r.equipment, []);
});
