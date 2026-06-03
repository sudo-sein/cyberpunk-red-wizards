import { test } from "node:test";
import { deepStrictEqual as eq, ok } from "node:assert/strict";
import { parseStatblock } from "../../scripts/import/statblock-parser.js";

const RAW = ` int ▶ ReF ▶ Dex ▶ teCh ▶ Cool
3 6 5 2 4
4 — 4 6 3
▶ hit Points ▶ seRously wounDeD ▶ DeAth sAve
35 18 6
▶ ARmoR
Armor: Kevlar 6
Head 7 SP
Body 7 SP
Weapons
Poor Quality Shotgun 5d6
Very Heavy Pistol 4d6
Armor: Kevlar®
Head 7 SP
Body 7 SP
Weapons
Poor Quality Shotgun 5d6
Very Heavy Pistol 4d6
▶ skill bAses Athletics 9, Brawling 11, Concentration 6, Handgun 10, Stealth 7
▶ CybeRwARe & sPeCiAl equiPment Slug Ammo x25, Radio Communicator`;

test("full OCR-cased mook parses all expected sections with a 5/5 score", async () => {
  const { template, errors, diagnostics } = await parseStatblock(RAW, "en");
  eq(errors, []);
  eq(template.hp, 35);
  eq(template.seriousWound, 18);
  eq(template.deathSave, 6);
  eq(template.armor.head.itemName, "Kevlar® (Head)");
  eq(template.skills.length, 5);
  ok(template.weapons.length >= 2);
  eq(diagnostics.score, { found: 5, total: 5 });
  eq(diagnostics.sections.skills, true);
  eq(diagnostics.sections.vitals, true);
});

test("a stats-only paste scores low and warns on the missing sections", async () => {
  const { warnings, diagnostics } = await parseStatblock(
    "▶ INT ▶ REF ▶ DEX ▶ TECH ▶ COOL 3 6 5 2 4\n4 — 4 6 3", "en");
  eq(diagnostics.score.found, 1);
  ok(warnings.some(w => w.section === "vitals"));
  ok(warnings.some(w => w.section === "skills"));
});
