import { MODULE_ID } from "../constants.js";

const MODULE_PATH = "modules/cyberpunk-red-wizards";

const TIER_FILES = [
  "amateur",
  "competent",
  "elite",
  "mini-boss",
  "nightmare-boss",
];

export const TIER_ORDER = [
  "amateur",
  "competent",
  "elite",
  "mini-boss",
  "nightmare-boss",
];

const npcCache = new Map();

export async function loadTierTemplates(tier) {
  if (npcCache.has(tier)) return npcCache.get(tier);

  const path = `${MODULE_PATH}/data/npc-templates/${tier}.json`;
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load NPC templates: ${path}`);
  const data = await response.json();
  npcCache.set(tier, data);
  return data;
}

export async function loadAllTemplates() {
  const all = [];
  for (const tier of TIER_FILES) {
    const templates = await loadTierTemplates(tier);
    all.push(...templates);
  }

  const custom = getCustomTemplates();
  all.push(...Object.values(custom));

  return all;
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

export function clearNpcCache() {
  npcCache.clear();
}
