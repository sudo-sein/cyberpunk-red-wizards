import StepBase from "./step-base.js";

const MODULE_PATH = "modules/cyberpunk-red-wizards";
const COLOR_CLASSES = { friends: "friends", loveAffairs: "love", enemies: "enemies" };

let relationshipTables = null;

async function loadRelationshipTables() {
  if (relationshipTables) return relationshipTables;
  const response = await fetch(`${MODULE_PATH}/data/relationships/tables.json`);
  if (!response.ok) throw new Error("Failed to load relationship tables");
  relationshipTables = await response.json();
  return relationshipTables;
}

export default class StepRelationships extends StepBase {
  constructor() {
    super("relationships", "crw.steps.relationships");
  }

  get template() {
    return `${MODULE_PATH}/templates/steps/relationships.hbs`;
  }

  async prepareContext(state) {
    const data = await loadRelationshipTables();

    return {
      types: data.types.map(typeDef => {
        const entries = state.relationships[typeDef.id] || [];
        const label = game.i18n.localize(typeDef.labelKey);
        const isComplex = typeDef.tables.length > 1;

        return {
          id: typeDef.id,
          label,
          colorClass: COLOR_CLASSES[typeDef.id],
          count: entries.length,
          isComplex,
          hasEntries: entries.length > 0,
          emptyMessage: game.i18n.localize("crw.relationships.noEntries"),
          entries: entries.map((entry, idx) => ({
            typeId: typeDef.id,
            index: idx,
            displayIndex: idx + 1,
            fields: typeDef.tables.map(tableDef => {
              const seen = new Set();
              const options = tableDef.entries
                .map(e => {
                  const text = game.i18n.localize(e.labelKey);
                  return { value: text, label: text };
                })
                .filter(o => {
                  if (seen.has(o.value)) return false;
                  seen.add(o.value);
                  return true;
                });

              return {
                typeId: typeDef.id,
                entryIndex: idx,
                tableId: tableDef.id,
                label: game.i18n.localize(tableDef.labelKey),
                currentValue: entry[tableDef.id] || "",
                options,
              };
            }),
          })),
        };
      }),
    };
  }

  activate(html, state, app) {
    html.querySelectorAll(".crw-relationships-header").forEach(header => {
      header.addEventListener("click", (e) => {
        if (e.target.closest(".crw-relationships-controls")) return;
        const body = header.nextElementSibling;
        body.classList.toggle("collapsed");
        const chevron = header.querySelector(".crw-relationships-chevron");
        chevron.textContent = body.classList.contains("collapsed") ? "▶" : "▼";
      });
    });

    html.querySelectorAll(".crw-relationships-count").forEach(input => {
      input.addEventListener("change", (e) => {
        const typeId = e.target.dataset.type;
        const count = Math.max(0, Math.min(3, parseInt(e.target.value) || 0));
        this._adjustEntries(state, typeId, count);
        app.render(true);
      });
    });

    html.querySelectorAll(".crw-relationships-roll-count").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._rollCount(state, app, btn.dataset.type);
      });
    });

    html.querySelectorAll(".crw-relationships-roll-field").forEach(btn => {
      btn.addEventListener("click", async () => {
        const { type, index, table } = btn.dataset;
        await this._rollSubTable(state, app, type, parseInt(index), table);
      });
    });

    html.querySelectorAll(".crw-relationships-roll-all-fields").forEach(btn => {
      btn.addEventListener("click", async () => {
        const { type, index } = btn.dataset;
        await this._rollAllFieldsForEntry(state, app, type, parseInt(index));
      });
    });

    html.querySelectorAll(".crw-relationships-select").forEach(select => {
      select.addEventListener("change", (e) => {
        const { type, index, table } = e.target.dataset;
        if (state.relationships[type]?.[parseInt(index)]) {
          state.relationships[type][parseInt(index)][table] = e.target.value;
        }
      });
    });

    const rollAllBtn = html.querySelector("[data-action='rollAll']");
    if (rollAllBtn) {
      rollAllBtn.addEventListener("click", async () => {
        await this._rollAll(state, app);
      });
    }
  }

  _emptyEntry(typeDef) {
    const entry = {};
    for (const table of typeDef.tables) {
      entry[table.id] = "";
    }
    return entry;
  }

  _adjustEntries(state, typeId, count) {
    const data = relationshipTables;
    if (!data) return;
    const typeDef = data.types.find(t => t.id === typeId);
    while (state.relationships[typeId].length < count) {
      state.relationships[typeId].push(this._emptyEntry(typeDef));
    }
    state.relationships[typeId].length = count;
  }

  async _rollCount(state, app, typeId, rerender = true) {
    const data = await loadRelationshipTables();
    const typeDef = data.types.find(t => t.id === typeId);
    const roll = await new Roll(typeDef.countDie).evaluate();
    const count = Math.max(0, roll.total + typeDef.countOffset);

    const typeName = game.i18n.localize(typeDef.labelKey);
    ui.notifications.info(game.i18n.format("crw.relationships.rolledCount", { count, type: typeName }));

    this._adjustEntries(state, typeId, count);
    if (rerender) app.render(true);
  }

  async _rollSubTable(state, app, typeId, entryIndex, tableId, rerender = true) {
    const data = await loadRelationshipTables();
    const typeDef = data.types.find(t => t.id === typeId);
    const tableDef = typeDef.tables.find(t => t.id === tableId);

    const roll = await new Roll(tableDef.die).evaluate();


    const entry = tableDef.entries.find(e => e.roll === roll.total);
    if (entry && state.relationships[typeId]?.[entryIndex]) {
      state.relationships[typeId][entryIndex][tableId] = game.i18n.localize(entry.labelKey);
    }

    if (rerender) app.render(true);
  }

  async _rollAllFieldsForEntry(state, app, typeId, entryIndex, rerender = true) {
    const data = await loadRelationshipTables();
    const typeDef = data.types.find(t => t.id === typeId);
    for (const tableDef of typeDef.tables) {
      await this._rollSubTable(state, app, typeId, entryIndex, tableDef.id, false);
    }
    if (rerender) app.render(true);
  }

  async _rollAll(state, app) {
    const data = await loadRelationshipTables();
    for (const typeDef of data.types) {
      await this._rollCount(state, app, typeDef.id, false);
      for (let i = 0; i < state.relationships[typeDef.id].length; i++) {
        await this._rollAllFieldsForEntry(state, app, typeDef.id, i, false);
      }
    }
    app.render(true);
  }

  validate(state) {
    return true;
  }

  serialize(html, state) {
    html.querySelectorAll(".crw-relationships-count").forEach(input => {
      const typeId = input.dataset.type;
      const count = Math.max(0, Math.min(3, parseInt(input.value) || 0));
      this._adjustEntries(state, typeId, count);
    });

    html.querySelectorAll(".crw-relationships-select").forEach(select => {
      const { type, index, table } = select.dataset;
      const idx = parseInt(index);
      if (state.relationships[type]?.[idx]) {
        state.relationships[type][idx][table] = select.value;
      }
    });

    return state;
  }
}
