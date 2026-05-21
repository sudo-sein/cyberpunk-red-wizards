import { test } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { buildStatsData } from "../../scripts/utils/derived-stats.js";
import { STAT_KEYS } from "../../scripts/constants.js";

const stats = { int: 7, ref: 6, dex: 6, tech: 5, cool: 6, will: 8, luck: 7, move: 7, body: 3, emp: 8 };

test("buildStatsData sets value for every stat", () => {
  const result = buildStatsData(stats);
  for (const key of STAT_KEYS) {
    strictEqual(result[key].value, stats[key], `${key}.value`);
  }
});

test("buildStatsData sets max equal to value for luck and emp", () => {
  const result = buildStatsData(stats);
  strictEqual(result.luck.max, 7);
  strictEqual(result.emp.max, 8);
});

test("buildStatsData does not set max for non-luck/emp stats", () => {
  const result = buildStatsData(stats);
  for (const key of ["int", "ref", "dex", "tech", "cool", "will", "move", "body"]) {
    strictEqual(result[key].max, undefined, `${key} should not have max`);
  }
});

test("buildStatsData returns correct shape", () => {
  const result = buildStatsData(stats);
  deepStrictEqual(result, {
    int:  { value: 7 },
    ref:  { value: 6 },
    dex:  { value: 6 },
    tech: { value: 5 },
    cool: { value: 6 },
    will: { value: 8 },
    luck: { value: 7, max: 7 },
    move: { value: 7 },
    body: { value: 3 },
    emp:  { value: 8, max: 8 },
  });
});
