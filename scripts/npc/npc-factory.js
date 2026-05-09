import { fetchCompendiumItem } from "../data/role-loader.js";

const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];

export async function createNpcFromTemplate(template, overrides = {}) {
  const name = overrides.name || game.i18n.localize(template.nameKey);
  const actorType = overrides.actorType || "mook";

  const isEveryday = template.tier === "everyday-people";

  const ActorClass = getDocumentClass("Actor");
  let actor = await ActorClass.create({
    name,
    type: actorType,
    prototypeToken: {
      name,
      actorLink: false,
      disposition: isEveryday ? 0 : -1,
      sight: { enabled: true },
      bar1: { attribute: "derivedStats.hp" },
    },
  });

  // Workaround for CPRMookActor.create() missing-return bug:
  // The override awaits super.create() but doesn't return it, so the caller
  // receives undefined. Fall back to finding the actor by name in game.actors.
  if (!actor) {
    actor = game.actors.getName(name);
    if (!actor) {
      throw new Error(`[NPC Factory] Failed to create actor "${name}" — CPRMookActor.create() returned undefined and actor not found in game.actors.`);
    }
    console.warn(`[NPC Factory] CPRMookActor.create() returned undefined; recovered actor "${name}" from game.actors.`);
  }

  const statsData = {};
  for (const key of STAT_KEYS) {
    const value = overrides.stats?.[key] ?? template.stats[key];
    statsData[key] = { value };
  }
  await actor.update({
    "system.stats": statsData,
    "system.derivedStats.hp.value": template.hp,
    "system.derivedStats.hp.max": template.hp,
  });

  // Update auto-populated skill levels
  for (const skill of template.skills) {
    const statKey = findStatForSkill(skill.name, actor);
    const statValue = overrides.stats?.[statKey] ?? template.stats[statKey] ?? 0;
    const level = Math.max(0, skill.base - statValue);
    const skillItem = actor.items.getName(skill.name);
    if (skillItem) {
      await skillItem.update({ "system.level": level });
    }
  }

  // Collect all items to add in one batch
  const itemsToCreate = [];

  // Armor
  if (template.armor.head) {
    const armorRef = resolveAlternative(template.armor.head, overrides, "armor-head");
    const item = await fetchCompendiumItem(armorRef.packName, armorRef.itemName);
    if (item) itemsToCreate.push(item.toObject());
  }
  if (template.armor.body) {
    const armorRef = resolveAlternative(template.armor.body, overrides, "armor-body");
    const item = await fetchCompendiumItem(armorRef.packName, armorRef.itemName);
    if (item) itemsToCreate.push(item.toObject());
  }

  // Weapons
  for (let i = 0; i < template.weapons.length; i++) {
    const weaponRef = resolveAlternative(template.weapons[i], overrides, `weapon-${i}`);
    const item = await fetchCompendiumItem(weaponRef.packName, weaponRef.itemName);
    if (item) itemsToCreate.push(item.toObject());
  }

  // Equipment
  for (let i = 0; i < template.equipment.length; i++) {
    const equipRef = resolveAlternative(template.equipment[i], overrides, `equip-${i}`);
    const item = await fetchCompendiumItem(equipRef.packName, equipRef.itemName);
    if (item) {
      const data = item.toObject();
      if (equipRef.quantity) data.system.amount = equipRef.quantity;
      itemsToCreate.push(data);
    }
  }

  // Cyberware
  for (let i = 0; i < template.cyberware.length; i++) {
    const cyberRef = resolveAlternative(template.cyberware[i], overrides, `cyber-${i}`);
    const item = await fetchCompendiumItem(cyberRef.packName, cyberRef.itemName);
    if (item) itemsToCreate.push(item.toObject());
  }

  // Role ability
  if (template.role) {
    const roleItem = await fetchCompendiumItem(template.role.packName, template.role.itemName);
    if (roleItem) {
      const roleData = roleItem.toObject();
      roleData.system.rank = template.role.rank;
      itemsToCreate.push(roleData);
    }
  }

  if (itemsToCreate.length > 0) {
    await actor.createEmbeddedDocuments("Item", itemsToCreate);
  }

  return actor;
}

function resolveAlternative(slot, overrides, key) {
  if (!slot.alternatives || !overrides.gear?.[key]) return slot;
  const idx = overrides.gear[key];
  return slot.alternatives[idx] ?? slot;
}

function findStatForSkill(skillName, actor) {
  const skillItem = actor.items.getName(skillName);
  if (skillItem) return skillItem.system?.stat ?? "int";
  return "int";
}
