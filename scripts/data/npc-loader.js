import { MODULE_ID } from "../constants.js";

const MODULE_PATH = "modules/cyberpunk-red-wizards";

export const BUILTIN_TEMPLATE_FILES = [
  "amateur",
  "competent",
  "elite",
  "mini-boss",
  "nightmare-boss",
];

const npcCache = new Map();

export async function loadTierTemplates(file) {
  if (npcCache.has(file)) return npcCache.get(file);

  const path = `${MODULE_PATH}/data/npc-templates/${file}.json`;
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load NPC templates: ${path}`);
  const data = await response.json();
  npcCache.set(file, data);
  return data;
}

export async function getBuiltinTemplates() {
  const all = [];
  for (const file of BUILTIN_TEMPLATE_FILES) {
    all.push(...await loadTierTemplates(file));
  }
  return all;
}

export async function loadAllTemplates() {
  const overrides = getBuiltinCategoryOverrides();
  const builtins = (await getBuiltinTemplates()).map(t => ({
    ...t,
    tier: overrides[t.id] ?? t.tier,
  }));

  const custom = getCustomTemplates();
  return [...builtins, ...Object.values(custom)];
}

export function getCustomTemplates() {
  try {
    return game.settings.get(MODULE_ID, "customNpcTemplates") ?? {};
  } catch {
    return {};
  }
}

export async function saveCustomTemplates(templates) {
  await game.settings.set(MODULE_ID, "customNpcTemplates", templates);
}

export function getCategoriesSetting() {
  try {
    return game.settings.get(MODULE_ID, "npcCategories");
  } catch {
    return undefined;
  }
}

export async function saveCategoriesSetting(list) {
  await game.settings.set(MODULE_ID, "npcCategories", list);
}

export function getBuiltinCategoryOverrides() {
  try {
    return game.settings.get(MODULE_ID, "npcBuiltinCategoryOverrides") ?? {};
  } catch {
    return {};
  }
}

export async function saveBuiltinCategoryOverrides(map) {
  await game.settings.set(MODULE_ID, "npcBuiltinCategoryOverrides", map);
}

export function clearNpcCache() {
  npcCache.clear();
}
