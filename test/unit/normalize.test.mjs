import { test } from "node:test";
import { deepStrictEqual as eq } from "node:assert/strict";
import { normalize } from "../../scripts/import/normalize.js";

const map = {
  labels: { junkArmorMarker: "▶ Armor", armorKeyword: "Armor:" },
  sectionHeaders: {
    stats: "▶ INT ▶ REF ▶ DEX ▶ TECH ▶ COOL",
    hp: "▶ Hit Points", armor: "Armor:", weapons: "Weapons",
    skills: "▶ Skill Bases", equipment: "▶ Cyberware & Special Equipment",
  },
};

test("strips residual junk armor block (keeps real second Armor block)", () => {
  const text = [
    "▶ Armor", "6 Armor: Kevlar", "Head 7 SP", "Body 7 SP",
    "Weapons", "Poor Quality Shotgun 5d6",
    "Armor: M Armorjack", "Head 13 SP", "Body 13 SP",
  ].join("\n");
  const { lines } = normalize(text, map);
  eq(lines.includes("6 Armor: Kevlar"), false, "junk Kevlar removed");
  eq(lines.includes("Armor: M Armorjack"), true, "real armor kept");
});

test("drops lone lowercase watermark line", () => {
  const text = "Persuasion 6,\ncyberpsycho\nResist Torture/Drugs 15";
  const { lines } = normalize(text, map);
  eq(lines.includes("cyberpsycho"), false);
});

test("collapses internal whitespace per line", () => {
  const { lines } = normalize("Head    13   SP", map);
  eq(lines[0], "Head 13 SP");
});
