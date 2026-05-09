const MODULE_PATH = "modules/cyberpunk-red-wizards";

const TIER_FILES = [
  "mooks",
  "lieutenants",
  "mini-bosses",
  "boss",
  "hardened-mooks",
  "hardened-lieutenants",
  "hardened-mini-bosses",
  "everyday-people",
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
  return all;
}

export function clearNpcCache() {
  npcCache.clear();
}
