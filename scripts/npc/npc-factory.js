import { fetchCompendiumItem } from "../utils/compendium.js";
import { addRoleItem } from "../utils/role.js";
import { buildStatsData } from "../utils/derived-stats.js";
import { STAT_KEYS } from "../constants.js";
import { waitFor } from "../utils/async.js";

export async function createNpcFromTemplate(template, overrides = {}) {
  const name = overrides.name || template.name || game.i18n.localize(template.nameKey);
  const actorType = overrides.actorType || "mook";

  const missing = [];
  const want = async (packName, itemName) => {
    const item = await fetchCompendiumItem(packName, itemName);
    if (!item) missing.push(itemName);
    return item;
  };

  const ActorClass = getDocumentClass("Actor");

  // CPRMookActor.create() has a missing-return bug: it awaits super.create()
  // but doesn't return the result, so the caller gets undefined. Register a
  // hook BEFORE calling create() so we can capture the actor when it arrives.
  let hookResolve;
  const hookPromise = new Promise(r => { hookResolve = r; });
  const hookId = Hooks.once("createActor", (a) => hookResolve(a));

  let actor = await ActorClass.create({
    name,
    type: actorType,
    prototypeToken: {
      name,
      actorLink: false,
      disposition: -1,
      sight: { enabled: true },
      bar1: { attribute: "derivedStats.hp" },
    },
  });

  if (!actor) {
    const created = await hookPromise;
    // CPRActor.create() continues asynchronously after the createActor hook
    // (it populates core skills, then installs cyberware via an update). Poll
    // for the actor to exist AND have its core skills, instead of a fixed
    // delay. Falls back after timeoutMs so a quiet actor never hangs creation.
    await waitFor(() => {
      const a = game.actors.get(created.id);
      return !!a && a.items.size > 0;
    }, { intervalMs: 50, timeoutMs: 3000 });
    actor = game.actors.get(created.id);
    if (!actor) {
      throw new Error(`[NPC Factory] Failed to create actor "${name}" — not found after hook recovery.`);
    }
    console.warn(`[NPC Factory] CPRMookActor.create() returned undefined; recovered actor via createActor hook.`);
  } else {
    Hooks.off("createActor", hookId);
  }

  const mergedStats = {};
  for (const key of STAT_KEYS) {
    mergedStats[key] = overrides.stats?.[key] ?? template.stats[key];
  }
  await actor.update({
    "system.stats": buildStatsData(mergedStats),
    "system.derivedStats.hp.value": template.hp,
    "system.derivedStats.hp.max": template.hp,
  });

  // Collect all items to add in one batch
  const itemsToCreate = [];

  // Skills: update levels for auto-populated skills; create specialty skills
  // (Martial Arts/Science/etc.) from their dedicated packs, since those are
  // not auto-populated on the actor.
  for (const skill of template.skills) {
    const skillName = normalizeSkillName(skill.name);
    const skillItem = actor.items.getName(skillName);
    if (skillItem) {
      const statKey = skillItem.system?.stat ?? "int";
      const statValue = overrides.stats?.[statKey] ?? template.stats[statKey] ?? 0;
      await skillItem.update({ "system.level": Math.max(0, skill.base - statValue) });
      continue;
    }
    const packName = specialtySkillPack(skillName);
    if (!packName) continue;
    const item = await want(packName, skillName);
    if (!item) continue;
    const data = item.toObject();
    const statKey = data.system?.stat ?? "int";
    const statValue = overrides.stats?.[statKey] ?? template.stats[statKey] ?? 0;
    data.system.level = Math.max(0, skill.base - statValue);
    itemsToCreate.push(data);
  }

  // Armor (skip entries without packName — SP may come from cyberware)
  if (template.armor.head?.packName) {
    const armorRef = resolveAlternative(template.armor.head, overrides, "armor-head");
    const item = await want(armorRef.packName, armorRef.itemName);
    if (item) {
      const data = item.toObject();
      data.system.equipped = "equipped";
      itemsToCreate.push(data);
    }
  }
  if (template.armor.body?.packName) {
    const armorRef = resolveAlternative(template.armor.body, overrides, "armor-body");
    const item = await want(armorRef.packName, armorRef.itemName);
    if (item) {
      const data = item.toObject();
      data.system.equipped = "equipped";
      itemsToCreate.push(data);
    }
  }

  // Weapons — compendium entries include quality suffix (e.g. "Shotgun (Poor)")
  for (let i = 0; i < template.weapons.length; i++) {
    const weaponRef = resolveAlternative(template.weapons[i], overrides, `weapon-${i}`);
    const weaponName = qualifyWeaponName(weaponRef.itemName, weaponRef.quality);
    let item = await fetchCompendiumItem(weaponRef.packName, weaponName);
    if (!item && weaponName !== weaponRef.itemName) {
      item = await fetchCompendiumItem(weaponRef.packName, weaponRef.itemName);
    }
    if (!item) missing.push(weaponRef.itemName);
    if (item) {
      const data = item.toObject();
      data.system.equipped = "equipped";
      itemsToCreate.push(data);
    }
  }

  // Equipment
  for (let i = 0; i < template.equipment.length; i++) {
    const equipRef = resolveAlternative(template.equipment[i], overrides, `equip-${i}`);
    const item = await want(equipRef.packName, equipRef.itemName);
    if (item) {
      const data = item.toObject();
      if (equipRef.quantity) data.system.amount = equipRef.quantity;
      itemsToCreate.push(data);
    }
  }

  // Cyberware — track count so we can install them after creation
  const cyberwareStartIdx = itemsToCreate.length;
  for (let i = 0; i < template.cyberware.length; i++) {
    const cyberRef = resolveAlternative(template.cyberware[i], overrides, `cyber-${i}`);
    const item = await want(cyberRef.packName, cyberRef.itemName);
    if (item) itemsToCreate.push(item.toObject());
  }
  const cyberwareCount = itemsToCreate.length - cyberwareStartIdx;

  // Role item is created separately via addRoleItem() to avoid the system's
  // unguarded createItem hook firing actor.update() on player clients.
  let roleItemData = null;
  if (template.role) {
    const roleItem = await want(template.role.packName, template.role.itemName);
    if (roleItem) {
      roleItemData = roleItem.toObject();
      if (template.role.rank != null) roleItemData.system.rank = template.role.rank;
    }
  }

  if (itemsToCreate.length > 0) {
    const created = await actor.createEmbeddedDocuments("Item", itemsToCreate);

    // Install cyberware into the actor so it counts as active
    if (cyberwareCount > 0) {
      const existingInstalled = actor.system.installedItems?.list ?? [];
      const newCyberwareIds = created
        .slice(cyberwareStartIdx, cyberwareStartIdx + cyberwareCount)
        .map(item => item.id);
      await actor.update({
        "system.installedItems.list": [...existingInstalled, ...newCyberwareIds],
      });
    }
  }

  if (roleItemData) {
    await addRoleItem(actor, roleItemData);
  }

  if (missing.length) {
    ui.notifications.warn(game.i18n.format("crw.npc.ui.missingItems", { items: [...new Set(missing)].join(", ") }));
  }

  return actor;
}

function qualifyWeaponName(baseName, quality) {
  if (!quality || quality === "standard") return baseName;
  const suffix = quality === "poor" ? " (Poor)" : " (Excellent)";
  return baseName + suffix;
}

function resolveAlternative(slot, overrides, key) {
  if (!slot.alternatives || !overrides.gear?.[key]) return slot;
  const idx = overrides.gear[key];
  return slot.alternatives[idx] ?? slot;
}

// Specialty skills are not auto-populated on the actor; map a parsed skill name
// to the compendium pack it lives in so the factory can create it. Returns null
// for ordinary (auto-populated) skills. "Local Expert (Your Home)" and
// "Language (Streetslang)" are auto-populated and resolve before reaching here.
// CPR has no "Native" language item; statblocks that say "Language (Native)"
// resolve to the English language skill.
function normalizeSkillName(name) {
  if (name === "Language (Native)") return "Language (English)";
  return name;
}

function specialtySkillPack(name) {
  if (name.startsWith("Martial Arts (")) return "core_skills-martial-arts";
  if (name.startsWith("Science (")) return "core_skills-science";
  if (name.startsWith("Play Instrument (")) return "core_skills-play-instrument";
  if (name.startsWith("Local Expert (")) return "core_skills-local-expert";
  if (name.startsWith("Language (")) return "core_skills-languages";
  return null;
}
