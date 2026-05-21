// tools/build-catalog.mjs
// Pure transform: extracted CPR core pack data -> editor option catalog.
// Input shape per pack: [{ name, type, damage?, sp? }, ...] keyed by "core/<pack>".

const QUALITY_SUFFIX = /\s*\((?:Poor|Excellent)\)\s*$/;
const ARMOR_SLOT = /\s*\((Head|Body)\)\s*$/;

const byName = (a, b) => a.name.localeCompare(b.name);
const byItemName = (a, b) => a.itemName.localeCompare(b.itemName);

// CPR uses type "base" for non-item helper documents: drug addiction/primary
// effect carriers and migration-artifact duplicates. They are never selectable
// gear, so drop them from every pack before building options.
const realItems = (list) => (list ?? []).filter((i) => i.type !== "base");

export function buildCatalog(packs) {
  const weapons = realItems(packs["core/weapons"])
    .filter((i) => !QUALITY_SUFFIX.test(i.name))
    .map((i) => ({ itemName: i.name, packName: "core_weapons", damage: i.damage ?? "" }))
    .sort(byItemName);

  const paired = new Map();
  const shields = [];
  for (const i of realItems(packs["core/armor"])) {
    const m = i.name.match(ARMOR_SLOT);
    if (!m) {
      shields.push(i);
      continue;
    }
    const base = i.name.replace(ARMOR_SLOT, "");
    const entry = paired.get(base) ?? { name: base };
    if (m[1] === "Head") {
      entry.headItem = i.name;
      entry.headSp = i.headSp;
    } else {
      entry.bodyItem = i.name;
      entry.bodySp = i.bodySp;
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

  const equipFrom = (list, packName) =>
    realItems(list)
      .filter((i) => !QUALITY_SUFFIX.test(i.name))
      .map((i) => ({ itemName: i.name, packName }));

  const equipment = [
    ...equipFrom(packs["core/gear"], "core_gear"),
    ...equipFrom(packs["core/drugs"], "core_drugs"),
    ...equipFrom(packs["core/ammo"], "core_ammo"),
    ...shields.filter((i) => !QUALITY_SUFFIX.test(i.name)).map((i) => ({ itemName: i.name, packName: "core_armor" })),
  ].sort(byItemName);

  const cyberware = realItems(packs["core/cyberware"])
    .map((i) => ({ itemName: i.name, packName: "core_cyberware" }))
    .sort(byItemName);

  return { armor, weapons, equipment, cyberware };
}
