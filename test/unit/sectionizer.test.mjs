import { test } from "node:test";
import { deepStrictEqual as eq } from "node:assert/strict";
import { sectionize } from "../../scripts/import/sectionizer.js";

const map = {
  labels: { armorKeyword: "Armor:", weaponsKeyword: "Weapons" },
  sectionHeaders: {
    stats: "▶ INT ▶ REF ▶ DEX ▶ TECH ▶ COOL",
    hp: "▶ Hit Points", armor: "Armor:", weapons: "Weapons",
    skills: "▶ Skill Bases", roleAbility: "▶ Role Ability", equipment: "▶ Cyberware & Special Equipment",
  },
};

test("captures the Role Ability section separately from skills and equipment", () => {
  const lines = [
    "▶ Skill Bases Athletics 10, Stealth 10",
    "▶ Role Ability Combat Awareness 6",
    "▶ Cyberware & Special Equipment Agent, Radio Communicator",
  ];
  const s = sectionize(lines, map);
  eq(s.roleAbility.join(" "), "▶ Role Ability Combat Awareness 6");
  eq(s.skills.join(" ").includes("Combat Awareness"), false);
  eq(s.equipment.join(" ").includes("Combat Awareness"), false);
});

test("does not treat 'Heavy Weapons' inside skills as a weapons section", () => {
  const lines = [
    "▶ INT ▶ REF ▶ DEX ▶ TECH ▶ COOL 5 8 8 5 4",
    "7 — 8 10 0",
    "▶ Hit Points ▶ Seriously Wounded ▶ Death Save 55 28 10",
    "Armor: Subdermal", "Head 11 SP", "Body 11 SP",
    "Weapons",
    "Popup Grenade Launcher 6d6 Cybersnake 4d6",
    "▶ Skill Bases Athletics 16, Heavy Weapons 14, Tracking 10",
    "▶ Cyberware & Special Equipment Cyberarm x2, Subdermal Armor",
  ];
  const s = sectionize(lines, map);
  eq(s.weapons.length, 1, "exactly one weapons block");
  eq(s.skills.join(" ").includes("Heavy Weapons 14"), true, "skills retained Heavy Weapons");
  eq(s.equipment.join(" ").includes("Subdermal Armor"), true);
});

test("collects repeated armor/weapons blocks in order", () => {
  const lines = [
    "Armor: Kevlar", "Head 7 SP", "Body 7 SP",
    "Weapons", "Shotgun 5d6",
    "Armor: M Armorjack", "Head 13 SP", "Body 13 SP",
    "Weapons", "Assault Rifle 5d6",
  ];
  const s = sectionize(lines, map);
  eq(s.armor.length, 2);
  eq(s.weapons.length, 2);
  eq(s.armor[0][0], "Armor: Kevlar");
  eq(s.weapons[1][0], "Assault Rifle 5d6");
});

test("captures stats header line and the following number line", () => {
  const lines = [
    "▶ INT ▶ REF ▶ DEX ▶ TECH ▶ COOL 4 8 6 4 6",
    "5 — 7 4",
    "▶ Hit Points 40 20 7",
  ];
  const s = sectionize(lines, map);
  eq(s.stats.length, 2);
  eq(s.stats[1], "5 — 7 4");
});
