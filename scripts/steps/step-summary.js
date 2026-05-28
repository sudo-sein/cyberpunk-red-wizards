import StepBase from "./step-base.js";
import { calculateAllDerived, buildStatsData } from "../utils/derived-stats.js";
import { STAT_KEYS } from "../constants.js";
import { runFullChecklist } from "../utils/validation.js";
import { loadRole } from "../data/role-loader.js";
import { fetchCompendiumItem, fetchCompendiumItems } from "../utils/compendium.js";
import { addRoleItem } from "../utils/role.js";
import { getEffectiveCreatorPointBudgets } from "../utils/creator-settings.js";

// Specialty skills not in internal_skills — fetch from dedicated packs.
// defaultName: specific item to look for; falls back to first item in pack.
const SPECIALTY_SKILLS = {
  "Local Expert": { pack: "core_skills-local-expert" },
  "Science": { pack: "core_skills-science" },
  "Play Instrument": { pack: "core_skills-play-instrument" },
  "Martial Arts": { pack: "core_skills-martial-arts", defaultName: "Martial Arts (Karate)" },
};

export default class StepSummary extends StepBase {
  constructor() {
    super("summary", "crw.steps.summary");
  }

  get template() {
    return "modules/cyberpunk-red-wizards/templates/steps/summary.hbs";
  }

  async prepareContext(state) {
    const budgets = getEffectiveCreatorPointBudgets(state);
    const checks = runFullChecklist(state, {
      statPointsTotal: budgets.statPointBudget,
      skillPointsTotal: budgets.skillPointBudget,
    });
    const derived = calculateAllDerived(state.stats);
    const roleData = state.role?.id ? await loadRole(state.role.id) : null;

    return {
      checks,
      handle: state.handle,
      roleName: state.role?.id ? game.i18n.localize(`crw.roles.${state.role.id}`) : "",
      methodName: state.method ? game.i18n.localize(`crw.methods.${state.method}`) : "",
      stats: STAT_KEYS.map(k => ({
        abbr: game.i18n.localize(`crw.stats.${k}`),
        value: state.stats[k],
      })),
      derived: [
        { label: game.i18n.localize("crw.derived.hp"), value: derived.hp },
        { label: game.i18n.localize("crw.derived.seriousWound"), value: derived.seriousWound },
        { label: game.i18n.localize("crw.derived.deathSave"), value: derived.deathSave },
        { label: game.i18n.localize("crw.derived.humanity"), value: derived.humanity },
        { label: game.i18n.localize("crw.derived.walk"), value: derived.walk },
        { label: game.i18n.localize("crw.derived.run"), value: derived.run },
      ],
      skills: state.skills.filter(s => s.level > 0).map(s => ({ name: s.name, level: s.level })),
      remainingEd: state.method === "complete" ? (state.gear.startingBudget ?? 2550) : (roleData?.startingCash ?? 0),
      relationshipSummary: this._buildRelationshipSummary(state),
    };
  }

  _buildRelationshipSummary(state) {
    const rel = state.relationships;
    if (!rel) return [];
    const sections = [];

    const friends = rel.friends.map(f => f.character).filter(Boolean);
    if (friends.length) {
      sections.push({
        label: game.i18n.localize("CPR.characterSheet.bottomPane.lifepath.friends"),
        items: friends,
      });
    }

    const love = rel.loveAffairs.map(l => l.story).filter(Boolean);
    if (love.length) {
      sections.push({
        label: game.i18n.localize("crw.relationships.loveAffairs"),
        items: love,
      });
    }

    const enemies = rel.enemies.map(e => {
      if (!e.who) return null;
      const details = [e.cause, e.resources, e.revenge].filter(Boolean).join(", ");
      return details ? `${e.who} (${details})` : e.who;
    }).filter(Boolean);
    if (enemies.length) {
      sections.push({
        label: game.i18n.localize("CPR.characterSheet.bottomPane.lifepath.enemies"),
        items: enemies,
      });
    }

    return sections;
  }

  _formatFriends(state) {
    const rel = state.relationships;
    if (!rel?.friends?.length) return "";
    return rel.friends.map(f => f.character).filter(Boolean).join(", ");
  }

  _formatLoveAffairs(state) {
    const rel = state.relationships;
    if (!rel?.loveAffairs?.length) return "";
    return rel.loveAffairs.map(l => l.story).filter(Boolean).join(", ");
  }

  _formatEnemies(state) {
    const rel = state.relationships;
    if (!rel?.enemies?.length) return "";
    return rel.enemies.map(e => {
      if (!e.who) return null;
      const details = [e.cause, e.resources, e.revenge].filter(Boolean).join(", ");
      return details ? `${e.who} (${details})` : e.who;
    }).filter(Boolean).join("; ");
  }

  validate(state) {
    const budgets = getEffectiveCreatorPointBudgets(state);
    const checks = runFullChecklist(state, {
      statPointsTotal: budgets.statPointBudget,
      skillPointsTotal: budgets.skillPointBudget,
    });
    return checks.every(c => c.passed);
  }

  async createCharacter(state) {
    const roleData = state.role?.id ? await loadRole(state.role.id) : null;

    const missing = [];
    const want = async (packName, itemName) => {
      const item = await fetchCompendiumItem(packName, itemName);
      if (!item) missing.push(itemName);
      return item;
    };

    // Create actor WITHOUT system data so cpr-actor.create() auto-populates
    // core skills and cyberware from internal compendium packs
    // Use implementation class so CPRActor.create() runs and populates core items
    const ActorClass = getDocumentClass("Actor");
    const actor = await ActorClass.create({
      name: state.handle,
      type: "character",
      prototypeToken: {
        name: state.handle,
        actorLink: true,
        disposition: 1,
        sight: { enabled: true },
        bar1: { attribute: "derivedStats.hp" },
      },
    });

    // CPRActor.create() auto-populates empty foundational cyberware containers
    // (Fashionware/Internal/External "Option Slots") that the creator never
    // uses. Uninstall first so deletion doesn't fight the install bookkeeping,
    // then remove the item docs so they don't clutter the sheet.
    await actor.update({ "system.installedItems.list": [] });
    const autoCyberwareIds = actor.itemTypes.cyberware.map((cw) => cw.id);
    if (autoCyberwareIds.length) {
      await actor.deleteEmbeddedDocuments("Item", autoCyberwareIds);
    }

    const statsData = buildStatsData(state.stats);
    const derived = calculateAllDerived(state.stats);
    const updateData = {
      "system.stats": statsData,
      "system.derivedStats.hp.max": derived.hp,
      "system.derivedStats.hp.value": derived.hp,
      "system.derivedStats.humanity.max": derived.humanity,
      "system.derivedStats.humanity.value": derived.humanity,
      "system.lifepath": {
        ...state.lifepath,
        friends: this._formatFriends(state),
        tragicLoveAffairs: this._formatLoveAffairs(state),
        enemies: this._formatEnemies(state),
      },
    };
    if (state.method === "complete") {
      updateData["system.wealth.value"] = state.gear.startingBudget ?? 2550;
    } else if (roleData?.startingCash != null) {
      updateData["system.wealth.value"] = roleData.startingCash;
    }
    await actor.update(updateData);

    // Update skill levels (core skills were auto-created above)
    const specialtySkillsToCreate = [];
    for (const skill of state.skills.filter(s => s.level > 0)) {
      const skillItem = actor.items.getName(skill.name);
      if (skillItem) {
        await skillItem.update({ "system.level": skill.level });
      } else if (SPECIALTY_SKILLS[skill.name]) {
        const { pack, defaultName } = SPECIALTY_SKILLS[skill.name];
        let doc = defaultName ? await want(pack, defaultName) : null;
        if (!doc) {
          const docs = await fetchCompendiumItems(pack);
          if (docs.length > 0) doc = docs[0];
        }
        if (doc) {
          const data = doc.toObject();
          data.system.level = skill.level;
          specialtySkillsToCreate.push(data);
        }
      } else {
        console.warn(`Skill "${skill.name}" not found on actor`);
      }
    }
    if (specialtySkillsToCreate.length > 0) {
      await actor.createEmbeddedDocuments("Item", specialtySkillsToCreate);
    }

    // Role item is created separately via addRoleItem() to avoid the system's
    // unguarded createItem hook. Equipment goes through the normal batch below.
    let roleItemData = null;
    if (state.role?.id) {
      const roleItem = await want("core_roles", game.i18n.localize(`crw.roles.${state.role.id}`));
      if (roleItem) {
        roleItemData = roleItem.toObject();
        roleItemData.system.rank = 4;
      }
    }

    const itemsToCreate = [];

    if (state.method !== "complete" && roleData?.equipment) {
      const equipCategories = ["weapons", "armor", "gear", "ammo", "cyberware"];
      let choiceIdx = 0;
      for (const cat of equipCategories) {
        const items = roleData.equipment[cat] ?? [];
        for (const item of items) {
          if (item.choice) {
            const options = item.choice.map(o =>
              typeof o === "string"
                ? { itemName: o, packName: item.packName }
                : { itemName: o.itemName, packName: o.packName ?? item.packName }
            );
            const chosenName = state.gear.choices?.[choiceIdx] ?? options[0].itemName;
            choiceIdx++;
            const opt = options.find(o => o.itemName === chosenName) ?? options[0];
            const compItem = await want(opt.packName, opt.itemName);
            if (compItem) itemsToCreate.push(compItem.toObject());
          } else {
            const compItem = await want(item.packName, item.itemName);
            if (compItem) {
              const itemData = compItem.toObject();
              if (item.quantity) itemData.system.amount = item.quantity;
              itemsToCreate.push(itemData);
            }
          }
        }
      }
    }

    if (itemsToCreate.length > 0) {
      await actor.createEmbeddedDocuments("Item", itemsToCreate);
    }

    if (roleItemData) {
      await addRoleItem(actor, roleItemData);
    }

    if (missing.length) {
      ui.notifications.warn(game.i18n.format("crw.creator.missingItems", { items: [...new Set(missing)].join(", ") }));
    }

    return actor;
  }

}
