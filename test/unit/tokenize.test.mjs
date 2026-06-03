import { test } from "node:test";
import { deepStrictEqual as eq } from "node:assert/strict";
import {
  splitTopLevel, extractStatNumbers, splitNameAndLevel,
  parseQuantity, stripQualityPrefix, splitOnParenBoundary, escapeRegExp,
  armorKeywordList, canonical, matchesHeader,
} from "../../scripts/import/tokenize.js";

test("splitTopLevel ignores commas inside parens", () => {
  eq(splitTopLevel("Neural Link (Chipware Socket, Pain Editor), Subdermal Armor", ","),
     ["Neural Link (Chipware Socket, Pain Editor)", "Subdermal Armor"]);
});
test("splitTopLevel plain", () => {
  eq(splitTopLevel("a, b, c", ","), ["a", "b", "c"]);
});
test("extractStatNumbers strips penalty parens and dash->0", () => {
  eq(extractStatNumbers("▶ INT ▶ REF ▶ DEX ▶ TECH ▶ COOL 4 8 (6) 6 (4) 4 6"),
     [4, 8, 6, 4, 6]);
});
test("extractStatNumbers second line with dash and missing", () => {
  eq(extractStatNumbers("5 — 7 4"), [5, 0, 7, 4]);
});
test("splitNameAndLevel glued number", () => {
  eq(splitNameAndLevel("Athletics12"), { name: "Athletics", level: 12 });
});
test("splitNameAndLevel spaced number with penalty paren", () => {
  eq(splitNameAndLevel("Athletics 10 (8)"), { name: "Athletics", level: 10 });
});
test("splitNameAndLevel keeps specialization paren before number", () => {
  eq(splitNameAndLevel("Local Expert (Your Home) 6"),
     { name: "Local Expert (Your Home)", level: 6 });
});
test("splitNameAndLevel no number", () => {
  eq(splitNameAndLevel("cyberpsycho"), { name: "cyberpsycho", level: null });
});
test("splitNameAndLevel discards trailing npc-name bleed after level", () => {
  eq(splitNameAndLevel("Tactics 12 hardened security officer"),
     { name: "Tactics", level: 12 });
});
test("parseQuantity x forms", () => {
  eq(parseQuantity("Rifle Ammo x50"), { name: "Rifle Ammo", quantity: 50 });
  eq(parseQuantity("Handcuffs x2"), { name: "Handcuffs", quantity: 2 });
  eq(parseQuantity("Cyberarm x2"), { name: "Cyberarm", quantity: 2 });
  eq(parseQuantity("Binoculars"), { name: "Binoculars", quantity: 1 });
});
test("stripQualityPrefix", () => {
  const map = { "Poor Quality": "poor", "Excellent": "excellent" };
  eq(stripQualityPrefix("Poor Quality Shotgun", map), { name: "Shotgun", quality: "poor" });
  eq(stripQualityPrefix("Assault Rifle", map), { name: "Assault Rifle", quality: "standard" });
});
test("stripQualityPrefix strips a trailing marker (PL suffix form)", () => {
  const map = { "niskiej jakości": "poor", "doskonałej jakości": "excellent" };
  eq(stripQualityPrefix("Strzelba niskiej jakości", map), { name: "Strzelba", quality: "poor" });
  eq(stripQualityPrefix("Kar. szturmowy doskonałej jakości", map),
     { name: "Kar. szturmowy", quality: "excellent" });
});
test("stripQualityPrefix leaves a clean name untouched", () => {
  const map = { "niskiej jakości": "poor" };
  eq(stripQualityPrefix("Bardzo ciężki pistolet", map),
     { name: "Bardzo ciężki pistolet", quality: "standard" });
});
test("armorKeywordList falls back to the single armorKeyword", () => {
  eq(armorKeywordList({ armorKeyword: "Armor:" }), ["Armor:"]);
  eq(armorKeywordList({ armorKeyword: "Pancerz:", armorKeywords: ["Pancerz:", "Armor:"] }),
     ["Pancerz:", "Armor:"]);
});
test("splitOnParenBoundary inserts comma after ) before Capital", () => {
  eq(splitOnParenBoundary("Bulletproof Shield (10 HP) Binoculars, Flashlight"),
     "Bulletproof Shield (10 HP), Binoculars, Flashlight");
});
test("splitOnParenBoundary leaves existing comma alone", () => {
  eq(splitOnParenBoundary("Cybereye (Targeting Scope, TeleOptics), Nasal Filters"),
     "Cybereye (Targeting Scope, TeleOptics), Nasal Filters");
});
test("escapeRegExp", () => {
  eq(escapeRegExp("a.b(c)"), "a\\.b\\(c\\)");
});
test("canonical folds bullet, case, and punctuation to alnum words", () => {
  eq(canonical("▶ CybeRwARe & sPeCiAl equiPment"), "cyberware special equipment");
  eq(canonical(" int ▶ ReF ▶ Dex ▶ teCh ▶ Cool"), "int ref dex tech cool");
  eq(canonical("Head 7 SP"), "head 7 sp");
});
test("matchesHeader is case/punctuation tolerant and word-anchored", () => {
  eq(matchesHeader("▶ hit Points ▶ seRously wounDeD 35 18 6", "▶ Hit Points"), true);
  eq(matchesHeader("▶ skill bAses Athletics 9", "▶ Skill Bases"), true);
  eq(matchesHeader("▶ CybeRwARe & sPeCiAl equiPment Slug Ammo x25", "▶ Cyberware & Special Equipment"), true);
  eq(matchesHeader("Skillz of the trade", "▶ Skill Bases"), false);
  eq(matchesHeader("Weaponstech 5", "Weapons"), false);
});
