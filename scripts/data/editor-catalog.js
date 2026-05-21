// scripts/data/editor-catalog.js
// Loads and shapes the editor's option catalog from data/editor-options.json
// (gear/weapons/cyberware/armor) and data/all-skills.json (skills). The shaped
// option objects match what the editor's buildOptions/resolveSelection expect.

const MODULE_PATH = "modules/cyberpunk-red-wizards";

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Generate ids for a list, suffixing duplicates (-2, -3, ...) so ids stay unique.
function withIds(list, nameKey) {
  const seen = new Map();
  return list.map((entry) => {
    let id = slugify(entry[nameKey]);
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    return { id, ...entry };
  });
}

export function shapeCatalog(raw) {
  const armor = [
    { id: "none", name: "None", sp: 0, packName: "", headItem: "", bodyItem: "" },
    ...withIds(
      (raw.armor ?? []).map((a) => ({
        name: a.name,
        sp: a.sp ?? 0,
        packName: a.packName,
        headItem: a.headItem ?? "",
        bodyItem: a.bodyItem ?? "",
      })),
      "name",
    ),
  ];
  const weapons = withIds(
    (raw.weapons ?? []).map((w) => ({ itemName: w.itemName, packName: w.packName, damage: w.damage ?? "" })),
    "itemName",
  );
  const equipment = withIds(
    (raw.equipment ?? []).map((e) => ({ itemName: e.itemName, packName: e.packName })),
    "itemName",
  );
  const cyberware = withIds(
    (raw.cyberware ?? []).map((c) => ({ itemName: c.itemName, packName: c.packName })),
    "itemName",
  );
  return { armor, weapons, equipment, cyberware };
}

export function flattenSkills(allSkills) {
  const names = new Set();
  for (const group of Object.values(allSkills)) {
    for (const skill of group) names.add(skill.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

let cache = null;

export async function loadEditorCatalog() {
  if (cache) return cache;
  const [optRes, skillRes] = await Promise.all([
    fetch(`${MODULE_PATH}/data/editor-options.json`),
    fetch(`${MODULE_PATH}/data/all-skills.json`),
  ]);
  if (!optRes.ok) throw new Error("Failed to load editor-options.json");
  if (!skillRes.ok) throw new Error("Failed to load all-skills.json");
  const shaped = shapeCatalog(await optRes.json());
  cache = { ...shaped, skills: flattenSkills(await skillRes.json()) };
  return cache;
}
