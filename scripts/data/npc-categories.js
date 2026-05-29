import {
  getCategoriesSetting, saveCategoriesSetting,
  getCustomTemplates, saveCustomTemplates,
  getBuiltinCategoryOverrides, saveBuiltinCategoryOverrides,
  getBuiltinTemplates,
} from "./npc-loader.js";

export const UNCATEGORIZED = "Uncategorized";
export const DEFAULT_CATEGORIES = ["Amateur", "Competent", "Elite", "Mini Boss", "Nightmare Boss"];

// Old slug tiers (pre display-name migration) mapped to their new default
// category names. Used by the one-time migration of existing custom templates.
export const LEGACY_CATEGORY_RENAMES = {
  "amateur": "Amateur",
  "competent": "Competent",
  "elite": "Elite",
  "mini-boss": "Mini Boss",
  "nightmare-boss": "Nightmare Boss",
};

export function getCategories() {
  const stored = getCategoriesSetting();
  return Array.isArray(stored) && stored.length ? stored : [...DEFAULT_CATEGORIES];
}

/**
 * The category group a template renders under. A built-in resolves via its
 * override then its JSON tier; a custom via its own tier. If the result is not
 * in the active category list, it falls back to UNCATEGORIZED.
 */
export function getEffectiveCategory(template, categories = getCategories(), overrides = getBuiltinCategoryOverrides()) {
  const isBuiltin = (template.source ?? "built-in") === "built-in";
  const assigned = isBuiltin ? (overrides[template.id] ?? template.tier) : template.tier;
  return categories.includes(assigned) ? assigned : UNCATEGORIZED;
}

function validateNewName(name, categories) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("Category name is blank.");
  if (trimmed === UNCATEGORIZED) throw new Error("'Uncategorized' is a reserved category name.");
  if (categories.includes(trimmed)) throw new Error(`Category "${trimmed}" is a duplicate.`);
  return trimmed;
}

export async function addCategory(name) {
  const categories = getCategories();
  const trimmed = validateNewName(name, categories);
  const next = [...categories, trimmed];
  await saveCategoriesSetting(next);
  return next;
}

export async function removeCategory(name) {
  const next = getCategories().filter(c => c !== name);
  await saveCategoriesSetting(next);
  return next;
}

export async function reorderCategory(name, direction) {
  const next = [...getCategories()];
  const i = next.indexOf(name);
  if (i < 0) return next;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= next.length) return next;
  [next[i], next[j]] = [next[j], next[i]];
  await saveCategoriesSetting(next);
  return next;
}

export async function renameCategory(oldName, newName) {
  const categories = getCategories();
  if (!categories.includes(oldName)) throw new Error(`Category "${oldName}" does not exist.`);
  const trimmed = validateNewName(newName, categories.filter(c => c !== oldName));

  const next = categories.map(c => (c === oldName ? trimmed : c));
  await saveCategoriesSetting(next);

  const custom = getCustomTemplates();
  let customChanged = false;
  for (const tpl of Object.values(custom)) {
    if (tpl.tier === oldName) { tpl.tier = trimmed; customChanged = true; }
  }
  if (customChanged) await saveCustomTemplates(custom);

  const overrides = getBuiltinCategoryOverrides();
  const builtins = await getBuiltinTemplates();
  let overridesChanged = false;
  for (const b of builtins) {
    const assigned = overrides[b.id] ?? b.tier;
    if (assigned === oldName) { overrides[b.id] = trimmed; overridesChanged = true; }
  }
  if (overridesChanged) await saveBuiltinCategoryOverrides(overrides);

  return next;
}

/**
 * One-time migration: rewrite legacy slug tiers ("competent", "mini-boss", ...)
 * on existing custom templates to the new default category names. Idempotent —
 * returns whether anything changed (and only writes the setting when it did).
 */
export async function migrateCustomTemplateCategories() {
  const custom = getCustomTemplates();
  let changed = false;
  for (const tpl of Object.values(custom)) {
    const mapped = LEGACY_CATEGORY_RENAMES[tpl.tier];
    if (mapped) { tpl.tier = mapped; changed = true; }
  }
  if (changed) await saveCustomTemplates(custom);
  return changed;
}
