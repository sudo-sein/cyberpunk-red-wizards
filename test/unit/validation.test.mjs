import { test } from "node:test";
import { strictEqual } from "node:assert/strict";
import {
  validateStatsComplete, validateStatsRolled, validateSkillsPointBuy, validateHumanity,
} from "../../scripts/utils/validation.js";

const full = { int: 6, ref: 6, dex: 6, tech: 6, cool: 6, will: 6, luck: 6, move: 6, body: 6, emp: 8 }; // sum 62
test("validateStatsComplete passes at 62 in range", () => {
  strictEqual(validateStatsComplete(full).valid, true);
});
test("validateStatsComplete fails when sum != 62", () => {
  strictEqual(validateStatsComplete({ ...full, emp: 7 }).valid, false);
});
test("validateStatsComplete fails when a stat is out of range", () => {
  strictEqual(validateStatsComplete({ ...full, emp: 2, luck: 12 }).valid, false);
});
test("validateStatsComplete honors custom total budget", () => {
  const custom = { ...full, int: 4, ref: 4, dex: 6, tech: 6, cool: 6, will: 6, luck: 6, move: 6, body: 6, emp: 8 }; // sum 58
  strictEqual(validateStatsComplete(custom, 58).valid, true);
  strictEqual(validateStatsComplete(custom, 62).valid, false);
});
test("validateStatsRolled requires all > 0", () => {
  strictEqual(validateStatsRolled(full).valid, true);
  strictEqual(validateStatsRolled({ ...full, luck: 0 }).valid, false);
});
test("validateSkillsPointBuy honors x2 difficulty cost", () => {
  // x2 costs double: level 6 x2 = 12, level 6 x1 = 6 each; 1×12 + 12×6 + 1×2 = 86
  const skills = [
    { level: 6, difficulty: "x2" },   // cost 12
    ...Array(12).fill({ level: 6, difficulty: "x1" }), // cost 72
    { level: 2, difficulty: "x1" },   // cost 2
  ]; // total 86, all levels in [0,6]
  strictEqual(validateSkillsPointBuy(skills).valid, true);
});
test("validateSkillsPointBuy fails when over the cap", () => {
  strictEqual(validateSkillsPointBuy([{ level: 6, difficulty: "x1" }]).valid, false);
});
test("validateSkillsPointBuy honors custom total budget", () => {
  strictEqual(validateSkillsPointBuy([{ level: 6, difficulty: "x1" }], 6).valid, true);
});
test("validateHumanity fails when loss meets humanity", () => {
  strictEqual(validateHumanity(40, 40).valid, false);
  strictEqual(validateHumanity(40, 39).valid, true);
});
