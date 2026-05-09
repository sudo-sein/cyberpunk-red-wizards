import StepBase from "./step-base.js";
import { calculateAllDerived } from "../utils/derived-stats.js";
import { runFullChecklist } from "../utils/validation.js";
import { loadRole, fetchCompendiumItem, fetchCompendiumItems } from "../data/role-loader.js";

const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];

// Specialty skills not in internal_skills — must be fetched from dedicated packs
const SPECIALTY_SKILL_PACKS = {
  "Local Expert": "core_skills-local-expert",
  "Science": "core_skills-science",
  "Play Instrument": "core_skills-play-instrument",
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
      remainingEd: roleData?.startingCash ?? (state.method === "complete" ? 2550 : 0),
    };
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

    // Set stats, lifepath, and wealth on the actor
    const statsData = {};
    for (const key of STAT_KEYS) {
      statsData[key] = { value: state.stats[key] };
    }
    const updateData = {
      "system.stats": statsData,
      "system.lifepath": state.lifepath,
    };
    if (roleData?.startingCash != null) {
      updateData["system.wealth.value"] = roleData.startingCash;
    } else if (state.method === "complete") {
      updateData["system.wealth.value"] = 2550;
    }
    await actor.update(updateData);

    // Update skill levels (core skills were auto-created above)
    const specialtySkillsToCreate = [];
    for (const skill of state.skills.filter(s => s.level > 0)) {
      const skillItem = actor.items.getName(skill.name);
      if (skillItem) {
        await skillItem.update({ "system.level": skill.level });
      } else if (SPECIALTY_SKILL_PACKS[skill.name]) {
        const docs = await fetchCompendiumItems(SPECIALTY_SKILL_PACKS[skill.name]);
        if (docs.length > 0) {
          const data = docs[0].toObject();
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
