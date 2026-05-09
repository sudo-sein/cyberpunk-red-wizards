import StepBase from "./step-base.js";
import { calculateAllDerived } from "../utils/derived-stats.js";
import { runFullChecklist } from "../utils/validation.js";
import { loadRole, fetchCompendiumItem } from "../data/role-loader.js";

const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];

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
    const derived = calculateAllDerived(state.stats);
    const roleData = state.role?.id ? await loadRole(state.role.id) : null;

    const statsData = {};
    for (const key of STAT_KEYS) {
      statsData[key] = { value: state.stats[key] };
    }

    const actorData = {
      name: state.handle,
      type: "character",
      system: {
        stats: statsData,
        lifepath: state.lifepath,
      },
      prototypeToken: {
        name: state.handle,
        actorLink: true,
        disposition: 1,
        sight: { enabled: true },
        bar1: { attribute: "derivedStats.hp" },
      },
    };

    const actor = await Actor.create(actorData);

    const itemsToCreate = [];

    // Role ability item from compendium
    if (state.role?.id) {
      const roleItem = await fetchCompendiumItem("core_roles", game.i18n.localize(`crw.roles.${state.role.id}`));
      if (roleItem) {
        const roleItemData = roleItem.toObject();
        roleItemData.system.rank = 4;
        itemsToCreate.push(roleItemData);
      }
    }

    // Equipment items (Streetrat/Edgerunner only)
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

    // Update skill levels on the actor (skills are auto-created by the system)
    for (const skill of state.skills.filter(s => s.level > 0)) {
      const skillItem = actor.items.getName(skill.name);
      if (skillItem) {
        await skillItem.update({ "system.level": skill.level });
      } else {
        console.warn(`Skill "${skill.name}" not found on actor`);
      }
    }

    // Set wealth
    if (roleData?.startingCash != null) {
      await actor.update({ "system.wealth.value": roleData.startingCash });
    } else if (state.method === "complete") {
      await actor.update({ "system.wealth.value": 2550 });
    }

    return actor;
  }

}
