import StepBase from "./step-base.js";
import { loadRole } from "../data/role-loader.js";
import { calculateCurrentEmp } from "../utils/derived-stats.js";

const GEAR_CATEGORIES = ["weapons", "armor", "gear", "ammo", "cyberware"];
const CATEGORY_LABELS = {
  weapons: "crw.gear.weapons",
  armor: "crw.gear.armor",
  gear: "crw.gear.gear",
  ammo: "crw.gear.ammo",
  cyberware: "crw.gear.cyberware",
};

export default class StepGear extends StepBase {
  constructor() {
    super("gear", "crw.steps.gear");
  }

  get template() {
    return null;
  }

  getTemplate(state) {
    if (state.method === "complete") {
      return "modules/cyberpunk-red-wizards/templates/steps/gear-placeholder.hbs";
    }
    return "modules/cyberpunk-red-wizards/templates/steps/gear-preset.hbs";
  }

  async prepareContext(state) {
    if (state.method === "complete") {
      if (!state.gear.startingBudget) state.gear.startingBudget = 2550;
      return { startingBudget: state.gear.startingBudget };
    }

    const roleData = await loadRole(state.role.id);
    if (!roleData?.equipment) return { categories: [], totalHumanityLoss: 0, currentEmp: state.stats.emp, startingCash: 0 };

    if (!state.gear.choices) {
      state.gear.choices = {};
    }

    let choiceIndex = 0;
    let totalHL = 0;
    const categories = [];

    for (const cat of GEAR_CATEGORIES) {
      const rawItems = roleData.equipment[cat] ?? [];
      if (rawItems.length === 0) continue;

      const items = [];
      for (const item of rawItems) {
        if (item.choice) {
          const idx = choiceIndex++;
          const optionNames = item.choice.map(o => (typeof o === "string" ? o : o.itemName));
          const selected = state.gear.choices[idx] ?? optionNames[0];
          state.gear.choices[idx] = selected;
          items.push({ choice: optionNames, choiceIndex: idx, selected });
        } else {
          items.push({
            name: item.itemName,
            quantity: item.quantity ?? null,
            humanityLoss: item.humanityLoss ?? null,
          });
          if (item.humanityLoss) totalHL += item.humanityLoss;
        }
      }

      categories.push({
        id: cat,
        label: game.i18n.localize(CATEGORY_LABELS[cat]),
        items,
      });
    }

    state.gear.totalHumanityLoss = totalHL;
    const humanity = state.stats.emp * 10 - totalHL;
    const currentEmp = calculateCurrentEmp(Math.max(0, humanity));

    return {
      categories,
      totalHumanityLoss: totalHL,
      currentEmp,
      startingCash: roleData.startingCash ?? 0,
    };
  }

  activate(html, state, app) {
    if (state.method === "complete") {
      html.querySelectorAll("select[name='startingBudget']").forEach(select => {
        select.addEventListener("change", (e) => {
          state.gear.startingBudget = parseInt(e.target.value);
        });
      });
      return;
    }

    html.querySelectorAll("select[name^='choice-']").forEach(select => {
      select.addEventListener("change", (e) => {
        const name = e.target.name;
        const idx = parseInt(name.replace("choice-", ""));
        state.gear.choices[idx] = e.target.value;
      });
    });
  }

  validate(state) {
    return true;
  }

  serialize(html, state) {
    return state;
  }
}
