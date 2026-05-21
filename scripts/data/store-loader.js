import { isPackExcluded } from "../app/store-pack-config.js";
import { MODULE_ID } from "../constants.js";

const STORE_ITEM_TYPES = new Set([
  "ammo", "armor", "clothing", "cyberware",
  "gear", "program", "itemUpgrade", "vehicle", "weapon",
]);

function classifyPackSource(packId) {
  if (packId.startsWith("cyberpunk-red-core.core_")) return "core";
  if (packId.startsWith("cyberpunk-red-core.black-chrome_")) return "blackChrome";
  if (packId.startsWith("cyberpunk-red-core.internal_")) return null;
  if (packId.startsWith("cyberpunk-red-core.other_")) return null;
  if (packId.startsWith("cyberpunk-red-core.")) return "dlc";
  return "dlc";
}

export async function loadStoreItems() {
  const excludedPacks = game.settings.get(MODULE_ID, "storeExcludedPacks");
  const items = [];

  for (const pack of game.packs) {
    if (pack.metadata.type !== "Item") continue;
    if (isPackExcluded(pack.metadata.id, excludedPacks)) continue;

    const source = classifyPackSource(pack.metadata.id);
    if (source === null) continue;

    const docs = await pack.getDocuments();
    for (const doc of docs) {
      if (!STORE_ITEM_TYPES.has(doc.type)) continue;
      items.push({
        uuid: doc.uuid,
        name: doc.name,
        type: doc.type,
        subtype: getItemSubtype(doc),
        price: doc.system.price?.market ?? 0,
        source,
        packId: pack.metadata.id,
        img: doc.img,
      });
    }
  }

  for (const doc of game.items) {
    if (!STORE_ITEM_TYPES.has(doc.type)) continue;
    items.push({
      uuid: doc.uuid,
      name: doc.name,
      type: doc.type,
      subtype: getItemSubtype(doc),
      price: doc.system.price?.market ?? 0,
      source: "world",
      packId: null,
      img: doc.img,
    });
  }

  return items;
}

function getItemSubtype(doc) {
  const st = doc.system.type;
  if (typeof st === "string" && st.length > 0) return st;
  return doc.type;
}

export function categorizeItems(items) {
  const categories = {};
  for (const type of STORE_ITEM_TYPES) {
    categories[type] = [];
  }
  for (const item of items) {
    if (categories[item.type]) {
      categories[item.type].push(item);
    }
  }
  for (const type of STORE_ITEM_TYPES) {
    categories[type].sort((a, b) => a.name.localeCompare(b.name));
  }
  return categories;
}

const SOURCE_ORDER = ["core", "blackChrome", "dlc", "world"];

export function groupBySource(items) {
  const groups = {};
  for (const item of items) {
    if (!groups[item.source]) groups[item.source] = [];
    groups[item.source].push(item);
  }
  return SOURCE_ORDER
    .filter(s => groups[s]?.length > 0)
    .map(s => ({
      key: s,
      label: `crw.store.groups.${s}`,
      items: groups[s],
    }));
}
