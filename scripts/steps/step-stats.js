import StepBase from "./step-base.js";
import { loadRole } from "../data/role-loader.js";
import { STAT_KEYS } from "../constants.js";
import { getEffectiveStatPointBudget } from "../utils/creator-settings.js";

const MIN_STAT = 2;
const MAX_STAT = 8;

export default class StepStats extends StepBase {
  constructor() {
    super("stats", "crw.steps.stats");
    this._selectedColumn = null;
    this._selectedColumns = {};
  }

  get template() {
    return null;
  }

  getTemplate(state) {
    if (state.method === "complete") {
      return "modules/cyberpunk-red-wizards/templates/steps/stats-pointbuy.hbs";
    }
    return "modules/cyberpunk-red-wizards/templates/steps/stats-roll.hbs";
  }

  async prepareContext(state) {
    if (state.method === "complete") {
      const totalPoints = getEffectiveStatPointBudget(state.statPointBudgetOverride);
      const statRows = STAT_KEYS.map(key => ({
        key,
        abbr: game.i18n.localize(`crw.stats.${key}`),
        fullName: game.i18n.localize(`crw.stats.${key}Full`),
        value: state.stats[key],
      }));
      const spent = STAT_KEYS.reduce((sum, k) => sum + state.stats[k], 0);
      return {
        statRows,
        totalPoints,
        remaining: totalPoints - spent,
        spentPercent: totalPoints > 0 ? Math.round((spent / totalPoints) * 100) : 0,
        hint: game.i18n.format("crw.stats.hint", { totalPoints }),
      };
    }

    const roleData = state.role?.id ? await loadRole(state.role.id) : null;
    const templates = roleData?.statTemplates ?? [];

    const templateCols = Array.from({ length: 10 }, (_, i) => ({
      label: String(i + 1),
      selected: state.method === "streetrat" && this._selectedColumn === i,
    }));

    const statRows = STAT_KEYS.map((key, statIdx) => {
      const selectedCol = state.method === "streetrat"
        ? this._selectedColumn
        : (this._selectedColumns[key] ?? null);

      const values = Array.from({ length: 10 }, (_, colIdx) => ({
        value: templates[colIdx]?.[statIdx] ?? 0,
        col: colIdx,
        selected: selectedCol === colIdx,
      }));

      const dimmed = state.method === "edgerunner" && selectedCol === null;

      return { key, abbr: game.i18n.localize(`crw.stats.${key}`), values, dimmed };
    });

    return {
      statRows,
      templateCols,
      method: state.method,
      roleName: roleData ? game.i18n.localize(roleData.nameKey) : "",
    };
  }

  activate(html, state, app) {
    if (state.method === "complete") {
      this._activatePointBuy(html, state, app);
    } else {
      this._activateRoll(html, state, app);
    }
  }

  _activatePointBuy(html, state, app) {
    const totalPoints = getEffectiveStatPointBudget(state.statPointBudgetOverride);
    html.querySelectorAll("[data-action='statInc']").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.stat;
        const spent = STAT_KEYS.reduce((sum, k) => sum + state.stats[k], 0);
        if (state.stats[key] < MAX_STAT && spent < totalPoints) {
          state.stats[key]++;
          app.render(true);
        }
      });
    });

    html.querySelectorAll("[data-action='statDec']").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.stat;
        if (state.stats[key] > MIN_STAT) {
          state.stats[key]--;
          app.render(true);
        }
      });
    });
  }

  _activateRoll(html, state, app) {
    html.querySelectorAll("td.crw-val").forEach(cell => {
      cell.addEventListener("click", async () => {
        const key = cell.dataset.stat;
        const col = parseInt(cell.dataset.col);
        const roleData = await loadRole(state.role.id);
        if (!roleData?.statTemplates) return;

        if (state.method === "streetrat") {
          this._selectedColumn = col;
          STAT_KEYS.forEach((k, i) => {
            state.stats[k] = roleData.statTemplates[col][i];
          });
        } else {
          this._selectedColumns[key] = col;
          const statIdx = STAT_KEYS.indexOf(key);
          state.stats[key] = roleData.statTemplates[col][statIdx];
        }
        app.render(true);
      });
    });

    const rollBtn = html.querySelector("[data-action='rollStats']");
    if (rollBtn) {
      rollBtn.addEventListener("click", async () => {
        const roleData = await loadRole(state.role.id);
        if (!roleData?.statTemplates) return;

        if (state.method === "streetrat") {
          const roll = await new Roll("1d10").evaluate();
          await roll.toMessage({ flavor: `${game.i18n.localize(roleData.nameKey)} — Stat Template Roll` });
          const col = roll.total - 1;
          this._selectedColumn = col;
          STAT_KEYS.forEach((k, i) => {
            state.stats[k] = roleData.statTemplates[col][i];
          });
        } else {
          const unselected = STAT_KEYS.filter(k => !(k in this._selectedColumns));
          const keysToRoll = unselected.length > 0 ? unselected : [...STAT_KEYS];
          const results = [];
          for (const k of keysToRoll) {
            const roll = await new Roll("1d10").evaluate();
            const col = roll.total - 1;
            const statIdx = STAT_KEYS.indexOf(k);
            this._selectedColumns[k] = col;
            state.stats[k] = roleData.statTemplates[col][statIdx];
            results.push(`${game.i18n.localize(`crw.stats.${k}`)}: ${roll.total}`);
          }
          await ChatMessage.create({
            content: `<strong>${game.i18n.localize(roleData.nameKey)} — Edgerunner Stat Rolls:</strong><br>${results.join(", ")}`
          });
        }
        app.render(true);
      });
    }

    html.querySelectorAll("[data-action='rollStat']").forEach(btn => {
      btn.addEventListener("click", async () => {
        const key = btn.dataset.stat;
        const roleData = await loadRole(state.role.id);
        if (!roleData?.statTemplates) return;

        const roll = await new Roll("1d10").evaluate();
        await roll.toMessage({ flavor: `${game.i18n.localize(roleData.nameKey)} — ${game.i18n.localize(`crw.stats.${key}`)} Roll` });
        const col = roll.total - 1;
        const statIdx = STAT_KEYS.indexOf(key);
        this._selectedColumns[key] = col;
        state.stats[key] = roleData.statTemplates[col][statIdx];
        app.render(true);
      });
    });
  }

  validate(state) {
    if (state.method === "complete") {
      const totalPoints = getEffectiveStatPointBudget(state.statPointBudgetOverride);
      const spent = STAT_KEYS.reduce((sum, k) => sum + state.stats[k], 0);
      return spent === totalPoints && STAT_KEYS.every(k => state.stats[k] >= MIN_STAT && state.stats[k] <= MAX_STAT);
    }
    if (state.method === "streetrat") {
      return this._selectedColumn !== null;
    }
    return STAT_KEYS.every(k => k in this._selectedColumns);
  }

  serialize(html, state) {
    return state;
  }
}
