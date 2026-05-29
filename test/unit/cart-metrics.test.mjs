import { test } from "node:test";
import { strictEqual } from "node:assert/strict";
import { plannedChangeCount } from "../../scripts/improvement/cart-metrics.js";

test("plannedChangeCount sums queued skill and role increments", () => {
  const cart = {
    skills: new Map([["skill-a", 2], ["skill-b", 1]]),
    roles: new Map([["role-a", 3]]),
    newRoles: new Map(),
  };

  strictEqual(plannedChangeCount(cart), 6);
});

test("plannedChangeCount includes planned rank for new roles", () => {
  const cart = {
    skills: new Map(),
    roles: new Map(),
    newRoles: new Map([
      ["new-role-a", { plannedRank: 1 }],
      ["new-role-b", { plannedRank: 2 }],
    ]),
  };

  strictEqual(plannedChangeCount(cart), 3);
});
