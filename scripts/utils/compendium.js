// scripts/utils/compendium.js
// Generic CPR compendium lookups by item name. Names are case/punctuation
// sensitive — see CLAUDE.md "Compendium item names must match exactly".

export async function fetchCompendiumItem(packName, itemName) {
  const pack = game.packs.get(`cyberpunk-red-core.${packName}`);
  if (!pack) {
    console.warn(`Pack not found: cyberpunk-red-core.${packName}`);
    return null;
  }
  const index = await pack.getIndex();
  const entry = index.find(e => e.name === itemName);
  if (!entry) {
    console.warn(`Item "${itemName}" not found in pack ${packName}`);
    return null;
  }
  return pack.getDocument(entry._id);
}

export async function fetchCompendiumItems(packName) {
  const pack = game.packs.get(`cyberpunk-red-core.${packName}`);
  if (!pack) {
    console.warn(`Pack not found: cyberpunk-red-core.${packName}`);
    return [];
  }
  return pack.getDocuments();
}
