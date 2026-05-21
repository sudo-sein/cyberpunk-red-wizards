import { test } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert/strict";
import {
  calculateHP, calculateSeriousWound, calculateHumanity,
  calculateCurrentEmp, calculateWalk, calculateRun, calculateAllDerived,
} from "../../scripts/utils/derived-stats.js";

test("calculateHP rounds up the body/will average", () => {
  strictEqual(calculateHP(5, 4), 35); // ceil(9/2)=5 -> 10+25
  strictEqual(calculateHP(8, 8), 50);
});
test("calculateSeriousWound uses ceil for odd HP", () => {
  strictEqual(calculateSeriousWound(35), 18);
  strictEqual(calculateSeriousWound(40), 20);
});
test("humanity is emp x10 and currentEmp divides back", () => {
  strictEqual(calculateHumanity(7), 70);
  strictEqual(calculateCurrentEmp(65), 7);
});
test("move derives walk x2 and run x4", () => {
  strictEqual(calculateWalk(6), 12);
  strictEqual(calculateRun(6), 24);
});
test("calculateAllDerived assembles every field", () => {
  deepStrictEqual(
    calculateAllDerived({ body: 8, will: 8, emp: 7, move: 6 }),
    { hp: 50, seriousWound: 25, deathSave: 8, humanity: 70, currentEmp: 7, walk: 12, run: 24 },
  );
});
