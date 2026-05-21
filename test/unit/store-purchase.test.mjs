import { test } from "node:test";
import { strictEqual } from "node:assert/strict";
import { calculateFinalPrice } from "../../scripts/store/store-purchase.js";

test("calculateFinalPrice applies markup percentage and ceils", () => {
  strictEqual(calculateFinalPrice(100, 100), 100);
  strictEqual(calculateFinalPrice(100, 150), 150);
  strictEqual(calculateFinalPrice(33, 150), 50); // ceil(49.5)
  strictEqual(calculateFinalPrice(100, 0), 0);
});
