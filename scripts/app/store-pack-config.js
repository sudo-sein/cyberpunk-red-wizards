import { MODULE_ID } from "../constants.js";

const PACK_GROUPS = [
  { key: "group:core", prefix: "cyberpunk-red-core.core_", label: "Core Rulebook" },
  { key: "group:blackChrome", prefix: "cyberpunk-red-core.black-chrome_", label: "Black Chrome" },
];

function classifyPack(packId) {
  for (const group of PACK_GROUPS) {
    if (packId.startsWith(group.prefix)) return group.key;
  }
  if (packId.startsWith("cyberpunk-red-core.dlc_")) return "dlc";
  return null;
}

export function isPackExcluded(packId, excluded) {
  if (excluded[packId]) return true;
  const group = classifyPack(packId);
  if (group && group !== "dlc" && excluded[group]) return true;
  return false;
}

export default class StorePackConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "crw-store-pack-config",
      title: game.i18n.localize("crw.store.settings.excludedPacks"),
      template: "modules/cyberpunk-red-wizards/templates/store-pack-config.hbs",
      width: 450,
      height: "auto",
      closeOnSubmit: true,
    });
  }

  getData() {
    const excluded = game.settings.get(MODULE_ID, "storeExcludedPacks");

    const groups = PACK_GROUPS.map(g => ({
      key: g.key,
      label: g.label,
      excluded: !!excluded[g.key],
    }));

    const dlcPacks = [];
    for (const pack of game.packs) {
      if (pack.metadata.type !== "Item") continue;
      if (classifyPack(pack.metadata.id) !== "dlc") continue;
      dlcPacks.push({
        id: pack.metadata.id,
        label: pack.metadata.label,
        excluded: !!excluded[pack.metadata.id],
      });
    }
    dlcPacks.sort((a, b) => a.label.localeCompare(b.label));

    return { groups, dlcPacks, hasDlc: dlcPacks.length > 0 };
  }

  async _updateObject(event, formData) {
    const excluded = {};
    for (const [key, value] of Object.entries(formData)) {
      if (value) excluded[key] = true;
    }
    await game.settings.set(MODULE_ID, "storeExcludedPacks", excluded);
  }
}
