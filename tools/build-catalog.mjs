// tools/build-catalog.mjs
// Pure transform: extracted CPR core pack data -> editor option catalog.
// Input shape per pack: [{ name, type, damage?, sp? }, ...] keyed by "core/<pack>".

const QUALITY_SUFFIX = /\s*\((?:Poor|Excellent)\)\s*$/;
const ARMOR_SLOT = /\s*\((Head|Body)\)\s*$/;

const byName = (a, b) => a.name.localeCompare(b.name);
const byItemName = (a, b) => a.itemName.localeCompare(b.itemName);

export function buildCatalog(packs) {
  const weapons = (packs["core/weapons"] ?? [])
    .filter((i) => !QUALITY_SUFFIX.test(i.name))
    .map((i) => ({ itemName: i.name, packName: "core_weapons", damage: i.damage ?? "" }))
    .sort(byItemName);

  const paired = new Map();
  const shields = [];
  for (const i of packs["core/armor"] ?? []) {
    const m = i.name.match(ARMOR_SLOT);
    if (!m) {
      shields.push(i);
      continue;
    }
    const base = i.name.replace(ARMOR_SLOT, "");
    const entry = paired.get(base) ?? { name: base };
    if (m[1] === "Head") {
      entry.headItem = i.name;
      entry.headSp = i.sp;
    } else {
      entry.bodyItem = i.name;
      entry.bodySp = i.sp;
    }
    paired.set(base, entry);
  }
  const armor = [...paired.values()]
    .map((e) => ({
      name: e.name,
      sp: e.bodySp ?? e.headSp ?? 0,
      packName: "core_armor",
      headItem: e.headItem ?? "",
      bodyItem: e.bodyItem ?? "",
    }))
    .sort(byName);

  const equipment = [
    ...(packs["core/gear"] ?? []).map((i) => ({ itemName: i.name, packName: "core_gear" })),
    ...(packs["core/drugs"] ?? []).map((i) => ({ itemName: i.name, packName: "core_drugs" })),
    ...(packs["core/ammo"] ?? []).map((i) => ({ itemName: i.name, packName: "core_ammo" })),
    ...shields.map((i) => ({ itemName: i.name, packName: "core_armor" })),
  ].sort(byItemName);

  const cyberware = (packs["core/cyberware"] ?? [])
    .map((i) => ({ itemName: i.name, packName: "core_cyberware" }))
    .sort(byItemName);

  return { armor, weapons, equipment, cyberware };
}
