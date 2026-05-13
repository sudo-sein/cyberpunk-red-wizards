import StepBase from "./step-base.js";

const MODULE_PATH = "modules/cyberpunk-red-wizards";
let generalTables = null;

async function loadGeneralTables() {
  if (generalTables) return generalTables;
  const response = await fetch(`${MODULE_PATH}/data/lifepath/general.json`);
  if (!response.ok) throw new Error("Failed to load lifepath tables");
  const data = await response.json();
  generalTables = data.tables;
  return generalTables;
}

export default class StepLifepath extends StepBase {
  constructor() {
    super("lifepath", "crw.steps.lifepath");
  }

  get template() {
    return "modules/cyberpunk-red-wizards/templates/steps/lifepath.hbs";
  }

  async prepareContext(state) {
    const tables = await loadGeneralTables();

    return {
      tables: tables.map(t => ({
        id: t.id,
        stateKey: t.stateKey,
        label: game.i18n.localize(t.labelKey),
        die: t.die,
        entries: t.entries.map(e => ({
          ...e,
          label: game.i18n.localize(e.labelKey)
        })),
        currentValue: state.lifepath[t.stateKey] ?? "",
      })),
    };
  }

  activate(html, state, app) {
    html.querySelectorAll(".crw-lifepath-select").forEach(select => {
      select.addEventListener("change", (e) => {
        const tableId = e.target.dataset.table;
        this._setLifepathValue(state, tableId, e.target.value);
      });
    });

    html.querySelectorAll("[data-action='rollTable']").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tableId = btn.dataset.table;
        const die = btn.dataset.die;
        await this._rollTable(state, app, tableId, die);
      });
    });

    const rollAllBtn = html.querySelector("[data-action='rollAll']");
    if (rollAllBtn) {
      rollAllBtn.addEventListener("click", async () => {
        const tables = await loadGeneralTables();
        for (const table of tables) {
          await this._rollTable(state, app, table.id, table.die, false);
        }
        app.render(true);
      });
    }
  }

  async _rollTable(state, app, tableId, die, rerender = true) {
    const tables = await loadGeneralTables();
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const roll = await new Roll(die).evaluate();

    const entry = table.entries.find(e => e.roll === roll.total);
    if (entry) {
      this._setLifepathValue(state, tableId, game.i18n.localize(entry.labelKey));
      if (entry.language) {
        this._addLanguageSkill(state, entry.language);
      }
    }

    if (rerender) app.render(true);
  }

  _setLifepathValue(state, tableId, value) {
    const tables = generalTables;
    if (!tables) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    state.lifepath[table.stateKey] = value;
  }

  _addLanguageSkill(state, language) {
    const skillName = `Language (${language})`;
    const existing = state.skills.find(s => s.name.startsWith("Language (") && s.category === "educationSkills");
    if (existing) {
      existing.name = skillName;
      existing.level = 4;
    }
  }

  validate(state) {
    return true;
  }

  serialize(html, state) {
    html.querySelectorAll(".crw-lifepath-select").forEach(select => {
      const tableId = select.dataset.table;
      this._setLifepathValue(state, tableId, select.value);
    });
    return state;
  }
}
