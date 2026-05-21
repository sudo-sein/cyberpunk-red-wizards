import StepBase from "./step-base.js";
import { calculateAllDerived } from "../utils/derived-stats.js";
import { runFullChecklist } from "../utils/validation.js";
import { loadRole, fetchCompendiumItem, fetchCompendiumItems } from "../data/role-loader.js";
import { STAT_KEYS } from "../constants.js";

// Specialty skills not in internal_skills — must be fetched from dedicated packs
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
    const checks = runFullChecklist(state);
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
    const checks = runFullChecklist(state);
    return checks.every(c => c.passed);
  }

  async createCharacter(state) {
    const roleData = state.role?.id ? await loadRole(state.role.id) : null;

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

    // Clear auto-installed cyberware — items stay in inventory but are not
    // considered installed, so humanity is unaffected.
    await actor.update({ "system.installedItems.list": [] });

    const statsData = {};
    for (const key of STAT_KEYS) {
      statsData[key] = { value: state.stats[key] };
    }
    const updateData = {
      "system.stats": statsData,
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
        let doc = defaultName ? await fetchCompendiumItem(pack, defaultName) : null;
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

    // Add role ability + equipment items
    const itemsToCreate = [];

    if (state.role?.id) {
      const roleItem = await fetchCompendiumItem("core_roles", game.i18n.localize(`crw.roles.${state.role.id}`));
      if (roleItem) {
        const roleItemData = roleItem.toObject();
        roleItemData.system.rank = 4;
        itemsToCreate.push(roleItemData);
      }
    }

    if (state.method !== "complete" && roleData?.equipment) {
      const equipCategories = ["weapons", "armor", "gear", "ammo", "cyberware"];
      let choiceIdx = 0;
      for (const cat of equipCategories) {
        const items = roleData.equipment[cat] ?? [];
        for (const item of items) {
          if (item.choice) {
            const chosenName = state.gear.choices?.[choiceIdx] ?? item.choice[0];
            choiceIdx++;
            const compItem = await fetchCompendiumItem(item.packName, chosenName);
            if (compItem) itemsToCreate.push(compItem.toObject());
          } else {
            const compItem = await fetchCompendiumItem(item.packName, item.itemName);
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

    return actor;
  }

}
