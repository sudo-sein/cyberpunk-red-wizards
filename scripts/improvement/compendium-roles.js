// Loads role items from the cyberpunk-red-core.core_roles compendium pack,
// excluding roles the actor already owns (matched by flags.core.sourceId,
// with name as fallback).

const PACK_ID = "cyberpunk-red-core.core_roles";

let cachedIndex = null;

export async function getBuyableRolesFor(actor) {
  const pack = game.packs.get(PACK_ID);
  if (!pack) return [];

  if (!cachedIndex) {
    cachedIndex = await pack.getIndex({ fields: ["name", "type"] });
  }

  const ownedSourceIds = new Set(
    actor.items
      .filter((i) => i.type === "role")
      .map((i) => i.getFlag?.("core", "sourceId") ?? null)
      .filter(Boolean)
  );
  const ownedNames = new Set(
    actor.items.filter((i) => i.type === "role").map((i) => i.name)
  );

  return cachedIndex
    .filter((e) => e.type === "role")
    .filter((e) => {
      const uuid = `Compendium.${PACK_ID}.${e._id}`;
      if (ownedSourceIds.has(uuid)) return false;
      if (ownedNames.has(e.name)) return false;
      return true;
    })
    .map((e) => ({
      packId: PACK_ID,
      sourceId: e._id,
      name: e.name,
      syntheticId: `new:${PACK_ID}:${e._id}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchRoleItemData(packId, sourceId) {
  const pack = game.packs.get(packId);
  if (!pack) throw new Error(`Pack not found: ${packId}`);
  const doc = await pack.getDocument(sourceId);
  if (!doc) throw new Error(`Role not found in pack: ${sourceId}`);
  // toObject() gives a clean creation-ready payload including system + flags.
  return doc.toObject();
}

export function clearRoleCompendiumCache() {
  cachedIndex = null;
}
