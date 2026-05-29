import assert from "node:assert/strict";
import test from "node:test";

import { categoryIsOpen } from "../../scripts/improvement/category-open-state.js";

test("categoryIsOpen defaults categories closed when no filter or user state exists", () => {
  assert.equal(categoryIsOpen({ key: "combatSkills", filterValue: "", openStates: new Map() }), false);
});

test("categoryIsOpen respects user-opened state", () => {
  const openStates = new Map([["combatSkills", true]]);

  assert.equal(categoryIsOpen({ key: "combatSkills", filterValue: "", openStates }), true);
});

test("categoryIsOpen respects user-closed state", () => {
  const openStates = new Map([["combatSkills", false]]);

  assert.equal(categoryIsOpen({ key: "combatSkills", filterValue: "", openStates }), false);
});

test("categoryIsOpen opens visible categories while filtering", () => {
  const openStates = new Map([["combatSkills", false]]);

  assert.equal(categoryIsOpen({ key: "combatSkills", filterValue: "handgun", openStates }), true);
});

test("categoryIsOpen ignores cart deltas", () => {
  assert.equal(
    categoryIsOpen({ key: "combatSkills", filterValue: "", openStates: new Map(), hasPlannedRows: true }),
    false,
  );
});
