import { test } from "node:test";
import { strictEqual } from "node:assert/strict";
import {
  skillCost,
  roleCost,
  cumulativeSkillCost,
  cumulativeRoleCost,
} from "../../scripts/improvement/ip-costs.js";

test("skillCost: typical scales 20 × nextLevel", () => {
  strictEqual(skillCost(1, "typical"), 20);
  strictEqual(skillCost(5, "typical"), 100);
  strictEqual(skillCost(10, "typical"), 200);
});

test("skillCost: difficult scales 40 × nextLevel", () => {
  strictEqual(skillCost(1, "difficult"), 40);
  strictEqual(skillCost(5, "difficult"), 200);
  strictEqual(skillCost(10, "difficult"), 400);
});

test("skillCost: unknown difficulty defaults to typical (20×)", () => {
  strictEqual(skillCost(3, "anything-else"), 60);
  strictEqual(skillCost(3, undefined), 60);
});

test("roleCost: scales 60 × nextRank", () => {
  strictEqual(roleCost(1), 60);
  strictEqual(roleCost(5), 300);
  strictEqual(roleCost(10), 600);
});

test("cumulativeSkillCost: delta 0 costs 0", () => {
  strictEqual(cumulativeSkillCost(4, 0, "typical"), 0);
  strictEqual(cumulativeSkillCost(0, 0, "difficult"), 0);
});

test("cumulativeSkillCost: typical 0 → 10 sums to 1100", () => {
  // 20+40+60+80+100+120+140+160+180+200 = 1100
  strictEqual(cumulativeSkillCost(0, 10, "typical"), 1100);
});

test("cumulativeSkillCost: difficult 4 → 6 sums to 200 + 240 = 440", () => {
  strictEqual(cumulativeSkillCost(4, 2, "difficult"), 440);
});

test("cumulativeRoleCost: delta 0 costs 0", () => {
  strictEqual(cumulativeRoleCost(3, 0), 0);
});

test("cumulativeRoleCost: 0 → 10 sums to 3300", () => {
  // 60+120+...+600 = 60 * (1+2+...+10) = 60 * 55 = 3300
  strictEqual(cumulativeRoleCost(0, 10), 3300);
});

test("cumulativeRoleCost: 4 → 5 single rank == 300", () => {
  strictEqual(cumulativeRoleCost(4, 1), 300);
});
