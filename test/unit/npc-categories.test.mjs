// test/unit/npc-categories.test.mjs
import { test, beforeEach } from "node:test";
import { strictEqual, deepStrictEqual, rejects } from "node:assert/strict";
import { clearNpcCache } from "../../scripts/data/npc-loader.js";
import {
  UNCATEGORIZED, DEFAULT_CATEGORIES,
  getCategories, getEffectiveCategory,
  addCategory, removeCategory, reorderCategory, renameCategory,
  migrateCustomTemplateCategories,
} from "../../scripts/data/npc-categories.js";

const M = "cyberpunk-red-wizards";

function installFakeSettings(initial = {}) {
  const store = new Map(Object.entries(initial));
  globalThis.game = {
    settings: {
      get: (m, k) => store.get(`${m}.${k}`),
      set: async (m, k, v) => { store.set(`${m}.${k}`, JSON.parse(JSON.stringify(v))); },
    },
  };
  return store;
}

beforeEach(() => clearNpcCache());

test("getCategories falls back to defaults when unset", () => {
  installFakeSettings();
  deepStrictEqual(getCategories(), DEFAULT_CATEGORIES);
});

test("getEffectiveCategory: custom in-list, custom missing, built-in override, built-in default", () => {
  installFakeSettings({
    [`${M}.npcCategories`]: ["Amateur", "Goons"],
    [`${M}.npcBuiltinCategoryOverrides`]: { "amateur": "Goons" },
  });
  const cats = getCategories();
  const ov = { "amateur": "Goons" };
  strictEqual(getEffectiveCategory({ source: "custom", tier: "Goons" }, cats, ov), "Goons");
  strictEqual(getEffectiveCategory({ source: "custom", tier: "Deleted" }, cats, ov), UNCATEGORIZED);
  strictEqual(getEffectiveCategory({ source: "built-in", id: "amateur", tier: "Amateur" }, cats, ov), "Goons");
  strictEqual(getEffectiveCategory({ source: "built-in", id: "elite", tier: "Amateur" }, cats, ov), "Amateur");
});

test("addCategory appends; rejects blank, duplicate, reserved", async () => {
  installFakeSettings({ [`${M}.npcCategories`]: ["Amateur"] });
  deepStrictEqual(await addCategory("Goons"), ["Amateur", "Goons"]);
  await rejects(() => addCategory("  "), /blank/);
  await rejects(() => addCategory("Amateur"), /duplicate/);
  await rejects(() => addCategory("Uncategorized"), /reserved/);
});

test("removeCategory drops the entry; assignments resolve to Uncategorized", async () => {
  installFakeSettings({ [`${M}.npcCategories`]: ["Amateur", "Goons"] });
  deepStrictEqual(await removeCategory("Goons"), ["Amateur"]);
  strictEqual(getEffectiveCategory({ source: "custom", tier: "Goons" }, getCategories()), UNCATEGORIZED);
});

test("reorderCategory moves up/down and clamps at ends", async () => {
  installFakeSettings({ [`${M}.npcCategories`]: ["A", "B", "C"] });
  deepStrictEqual(await reorderCategory("B", "up"), ["B", "A", "C"]);
  deepStrictEqual(await reorderCategory("B", "up"), ["B", "A", "C"]); // already first
  deepStrictEqual(await reorderCategory("A", "down"), ["B", "C", "A"]);
});

test("renameCategory cascades to custom templates and built-in overrides", async () => {
  const store = installFakeSettings({
    [`${M}.npcCategories`]: ["Amateur", "Competent"],
    [`${M}.customNpcTemplates`]: {
      x: { id: "x", source: "custom", tier: "Amateur" },
      y: { id: "y", source: "custom", tier: "Competent" },
    },
    [`${M}.npcBuiltinCategoryOverrides`]: {},
  });
  deepStrictEqual(await renameCategory("Amateur", "Goons"), ["Goons", "Competent"]);
  strictEqual(store.get(`${M}.customNpcTemplates`).x.tier, "Goons");
  strictEqual(store.get(`${M}.customNpcTemplates`).y.tier, "Competent");
  strictEqual(store.get(`${M}.npcBuiltinCategoryOverrides`).amateur, "Goons");
});

test("renameCategory rejects invalid new names", async () => {
  installFakeSettings({ [`${M}.npcCategories`]: ["Amateur", "Competent"] });
  await rejects(() => renameCategory("Amateur", "Competent"), /duplicate/);
  await rejects(() => renameCategory("Amateur", "Uncategorized"), /reserved/);
  await rejects(() => renameCategory("Amateur", ""), /blank/);
});

test("migrateCustomTemplateCategories remaps legacy slug tiers to display names", async () => {
  const store = installFakeSettings({
    [`${M}.customNpcTemplates`]: {
      a: { id: "a", source: "custom", tier: "competent" },
      b: { id: "b", source: "imported", tier: "mini-boss" },
      c: { id: "c", source: "custom", tier: "Goons" },
    },
  });
  const changed = await migrateCustomTemplateCategories();
  strictEqual(changed, true);
  strictEqual(store.get(`${M}.customNpcTemplates`).a.tier, "Competent");
  strictEqual(store.get(`${M}.customNpcTemplates`).b.tier, "Mini Boss");
  strictEqual(store.get(`${M}.customNpcTemplates`).c.tier, "Goons");
});

test("migrateCustomTemplateCategories is a no-op when nothing to migrate", async () => {
  installFakeSettings({ [`${M}.customNpcTemplates`]: { a: { id: "a", tier: "Amateur" } } });
  const changed = await migrateCustomTemplateCategories();
  strictEqual(changed, false);
});
