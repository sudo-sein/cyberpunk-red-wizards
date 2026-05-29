// test/unit/npc-loader.test.mjs
import { test, beforeEach } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert/strict";
import { getBuiltinTemplates, loadAllTemplates, clearNpcCache } from "../../scripts/data/npc-loader.js";

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

beforeEach(() => { clearNpcCache(); });

test("getBuiltinTemplates returns the 5 built-ins with display-name tiers", async () => {
  installFakeSettings();
  const builtins = await getBuiltinTemplates();
  strictEqual(builtins.length, 5);
  const byId = Object.fromEntries(builtins.map(b => [b.id, b.tier]));
  deepStrictEqual(byId, {
    "amateur": "Amateur",
    "competent": "Competent",
    "elite": "Elite",
    "mini-boss": "Mini Boss",
    "nightmare-boss": "Nightmare Boss",
  });
});

test("loadAllTemplates applies built-in category overrides without mutating defaults", async () => {
  installFakeSettings({
    "cyberpunk-red-wizards.customNpcTemplates": {},
    "cyberpunk-red-wizards.npcBuiltinCategoryOverrides": { "amateur": "Goons" },
  });
  const all = await loadAllTemplates();
  const amateur = all.find(t => t.id === "amateur");
  strictEqual(amateur.tier, "Goons");

  // Second load with no override returns the JSON default (no leaked mutation).
  installFakeSettings();
  clearNpcCache();
  const again = await loadAllTemplates();
  strictEqual(again.find(t => t.id === "amateur").tier, "Amateur");
});
