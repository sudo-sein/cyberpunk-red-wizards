import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const template = await readFile(new URL("../../templates/improvement.hbs", import.meta.url), "utf8");

test("cart summary is a global bar between actor picker and skills/roles body", () => {
  const actorPickerIndex = template.indexOf("crw-improvement-actor-picker");
  const summaryIndex = template.indexOf("crw-improvement-cart-summary");
  const bodyIndex = template.indexOf("crw-improvement-body");

  assert.ok(actorPickerIndex >= 0, "actor picker should be present");
  assert.ok(summaryIndex >= 0, "cart summary should be present");
  assert.ok(bodyIndex >= 0, "skills/roles body should be present");
  assert.ok(actorPickerIndex < summaryIndex, "summary should appear after actor picker");
  assert.ok(summaryIndex < bodyIndex, "summary should appear before the skills/roles body");
});

test("cart summary is always rendered and switches text inside the reserved bar", () => {
  const summaryBlock = template.match(/<div class="crw-improvement-cart-summary">[\s\S]*?<\/div>/)?.[0] ?? "";

  assert.ok(summaryBlock, "summary block should exist");
  assert.match(summaryBlock, /{{#if plannedChanges}}/, "summary text should branch on planned changes");
  assert.match(summaryBlock, /crw\.improvement\.cart\.summary/, "non-empty summary text should be present");
  assert.match(summaryBlock, /crw\.improvement\.cart\.emptySummary/, "empty summary text should be present");
});

test("cart summary block is not wrapped in plannedChanges conditional", () => {
  const plannedIfIndex = template.indexOf("{{#if plannedChanges}}");
  const summaryIndex = template.indexOf("crw-improvement-cart-summary");

  assert.ok(summaryIndex >= 0, "summary should be present");
  assert.notEqual(plannedIfIndex, -1, "template should still use plannedChanges for text/badges");
  assert.ok(summaryIndex < plannedIfIndex || template.slice(plannedIfIndex, summaryIndex).includes("</div>"));
});
