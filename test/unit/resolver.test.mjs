import { test } from "node:test";
import { deepStrictEqual as eq } from "node:assert/strict";
import {
  resolveWeapon, resolveSkillOrRole, resolveEquipmentToken, resolveRoleName, addCyberware,
} from "../../scripts/import/resolver.js";

const map = {
  qualityPrefixes: { "Poor Quality": "poor", "Excellent": "excellent" },
  weapons: { "Assault Rifle": "Assault Rifle", "Wolvers": "Wolvers", "Heavy SMG": "Heavy SMG", "Medium Melee Weapon": "Medium Melee" },
  cyberwareWeapons: ["Wolvers", "Popup Grenade Launcher", "Cybersnake"],
  weaponUpgrades: { "Underbarrel Shotgun": { packName: "core_upgrades", itemName: "Shotgun Underbarrel" } },
  popupWeapons: { "Popup Heavy SMG": { weapon: "Heavy SMG", mount: "Popup Ranged Weapon" } },
  roleAbilities: { "Combat Awareness": "Solo", "Moto Family": "Nomad" },
  skills: { "Athletics": "Athletics", "Local Expert": "Local Expert" },
  ammo: { "Rifle Ammo": { packName: "core_ammo", itemName: "Rifle (Basic)" } },
  equipment: {
    "Neural Link": { packName: "core_cyberware", itemName: "Neural Link" },
    "Chipware Socket": { packName: "core_cyberware", itemName: "Chipware Socket" },
    "Pain Editor": { packName: "core_cyberware", itemName: "Pain Editor" },
    "Cyberarm": { packName: "core_cyberware", itemName: "Cyberarm" },
    "Binoculars": { packName: "core_gear", itemName: "Binoculars" },
    "Bulletproof Shield": { packName: "core_armor", itemName: "Bullet Proof Shield" },
    "Cybereye": { packName: "core_cyberware", itemName: "Cybereye" },
    "Lowlight/Infrared/UV": { packName: "core_cyberware", itemName: "Low Light/IR/UV" },
  },
};

test("resolveWeapon normal weapon", () => {
  eq(resolveWeapon("Assault Rifle", "5d6", map).entries,
     [{ kind: "weapon", packName: "core_weapons", itemName: "Assault Rifle", quality: "standard", damage: "5d6" }]);
});
test("resolveWeapon quality prefix", () => {
  eq(resolveWeapon("Poor Quality Shotgun", "5d6", { ...map, weapons: { ...map.weapons, "Shotgun": "Shotgun" } }).entries[0].quality, "poor");
});
test("resolveWeapon cyberware weapon not in weapons map routes to cyberware", () => {
  eq(resolveWeapon("Popup Grenade Launcher", "6d6", map).entries,
     [{ kind: "cyberware", packName: "core_cyberware", itemName: "Popup Grenade Launcher" }]);
});
test("resolveWeapon cyberware weapon also in weapons map routes to cyberware", () => {
  eq(resolveWeapon("Wolvers", "3d6", map).entries,
     [{ kind: "cyberware", packName: "core_cyberware", itemName: "Wolvers" }]);
});
test("resolveWeapon popup splits into weapon + mount", () => {
  eq(resolveWeapon("Popup Heavy SMG", "3d6", map).entries, [
    { kind: "weapon", packName: "core_weapons", itemName: "Heavy SMG", quality: "standard", damage: "3d6" },
    { kind: "cyberware", packName: "core_cyberware", itemName: "Popup Ranged Weapon" },
  ]);
});
test("resolveWeapon routes weapon upgrade to equipment", () => {
  eq(resolveWeapon("Underbarrel Shotgun", "3d6", map).entries,
     [{ kind: "equipment", packName: "core_upgrades", itemName: "Shotgun Underbarrel", quantity: 1 }]);
});
test("resolveWeapon unknown produces error", () => {
  const r = resolveWeapon("Frob Cannon", "9d6", map);
  eq(r.entries, []);
  eq(r.errors.length, 1);
});
test("resolveRoleName detects parenthesised role name", () => {
  eq(resolveRoleName("(Solo)", map), { itemName: "Solo", rank: null });
});
test("resolveRoleName extracts rank and ignores name-bleed prefix", () => {
  eq(resolveRoleName("hardened arasaka assassin (Solo 6)", map), { itemName: "Solo", rank: 6 });
});
test("resolveRoleName returns null for non-role token", () => {
  eq(resolveRoleName("Tech Bag", map), null);
});
test("resolveSkillOrRole detects role ability", () => {
  eq(resolveSkillOrRole("Moto Family", 4, map),
     { kind: "role", role: { packName: "core_roles", itemName: "Nomad", rank: 4 } });
});
test("resolveSkillOrRole plain skill", () => {
  eq(resolveSkillOrRole("Athletics", 16, map),
     { kind: "skill", skill: { name: "Athletics", base: 16 }, matched: true });
});
test("resolveSkillOrRole specialization", () => {
  eq(resolveSkillOrRole("Local Expert (Your Home)", 7, map),
     { kind: "skill", skill: { name: "Local Expert (Your Home)", base: 7 }, matched: true });
});
test("resolveEquipmentToken ammo with quantity", () => {
  eq(resolveEquipmentToken("Rifle Ammo x50", map).entries,
     [{ packName: "core_ammo", itemName: "Rifle (Basic)", quantity: 50 }]);
});
test("resolveEquipmentToken multi-option cyberware expands", () => {
  eq(resolveEquipmentToken("Neural Link (Chipware Socket, Pain Editor)", map).entries, [
    { packName: "core_cyberware", itemName: "Neural Link", quantity: 1 },
    { packName: "core_cyberware", itemName: "Chipware Socket", quantity: 1 },
    { packName: "core_cyberware", itemName: "Pain Editor", quantity: 1 },
  ]);
});
test("resolveEquipmentToken cyberlimb base keeps quantity-stripped name", () => {
  const e = resolveEquipmentToken("Cyberarm x2 (Pain Editor)", map).entries;
  eq(e[0], { packName: "core_cyberware", itemName: "Cyberarm", quantity: 2 });
  eq(e[1], { packName: "core_cyberware", itemName: "Pain Editor", quantity: 1 });
});
test("resolveEquipmentToken popup in equipment yields mount only", () => {
  eq(resolveEquipmentToken("Popup Heavy SMG", map).entries,
     [{ packName: "core_cyberware", itemName: "Popup Ranged Weapon", quantity: 1 }]);
});
test("resolveEquipmentToken Bulletproof Shield (10 HP) keeps base, drops bad option", () => {
  const r = resolveEquipmentToken("Bulletproof Shield (10 HP)", map);
  eq(r.entries, [{ packName: "core_armor", itemName: "Bullet Proof Shield", quantity: 1 }]);
});
test("resolveEquipmentToken Base (clarifier) xN applies qty to base and dedupes", () => {
  const m = { ...map, ammo: { ...map.ammo, "Flamethrower Ammo": { packName: "core_ammo", itemName: "Shotgun Shell (Incendiary)" }, "Incendiary Shotgun Shells": { packName: "core_ammo", itemName: "Shotgun Shell (Incendiary)" } } };
  eq(resolveEquipmentToken("Flamethrower Ammo (Incendiary Shotgun Shells) x8", m).entries,
     [{ packName: "core_ammo", itemName: "Shotgun Shell (Incendiary)", quantity: 8 }]);
});
test("resolveEquipmentToken splits 'w/' clause into base + accessory", () => {
  eq(resolveEquipmentToken("Cybereye x2 w/ Lowlight/Infrared/UV", map).entries, [
    { packName: "core_cyberware", itemName: "Cybereye", quantity: 2 },
    { packName: "core_cyberware", itemName: "Low Light/IR/UV", quantity: 1 },
  ]);
});
test("addCyberware dedups by itemName", () => {
  const list = [];
  addCyberware(list, "core_cyberware", "Neural Link");
  addCyberware(list, "core_cyberware", "Neural Link");
  eq(list.length, 1);
});
