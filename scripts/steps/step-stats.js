import StepBase from "./step-base.js";
import { loadRole } from "../data/role-loader.js";

const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];
const TOTAL_POINTS = 62;
const MIN_STAT = 2;
const MAX_STAT = 8;

export default class StepStats extends StepBase {
  constructor() {
    super("stats", "crw.steps.stats");
    this._rollResult = null;
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
    const statRows = STAT_KEYS.map(key => ({
      key,
      abbr: game.i18n.localize(`crw.stats.${key}`),
      fullName: game.i18n.localize(`crw.stats.${key}Full`),
      value: state.stats[key],
    }));

    if (state.method === "complete") {
      const spent = STAT_KEYS.reduce((sum, k) => sum + state.stats[k], 0);
      return {
        statRows,
        remaining: TOTAL_POINTS - spent,
        spentPercent: Math.round((spent / TOTAL_POINTS) * 100),
      };
    }

    const roleData = state.role?.id ? await loadRole(state.role.id) : null;
    return {
      statRows,
      method: state.method,
      roleName: roleData ? game.i18n.localize(roleData.nameKey) : "",
      rollResult: this._rollResult,
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
    html.querySelectorAll("[data-action='statInc']").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.stat;
        const spent = STAT_KEYS.reduce((sum, k) => sum + state.stats[k], 0);
        if (state.stats[key] < MAX_STAT && spent < TOTAL_POINTS) {
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
    const rollBtn = html.querySelector("[data-action='rollStats']");
    if (rollBtn) {
      rollBtn.addEventListener("click", async () => {
        const roleData = await loadRole(state.role.id);
        if (!roleData?.statTemplates) return;

        if (state.method === "streetrat") {
          const roll = await new Roll("1d10").evaluate();
          await roll.toMessage({ flavor: `${game.i18n.localize(roleData.nameKey)} — Stat Template Roll` });
          const row = roleData.statTemplates[roll.total - 1];
          STAT_KEYS.forEach((key, i) => { state.stats[key] = row[i]; });
          this._rollResult = roll.total;
        } else {
          const rolls = [];
          for (let i = 0; i < STAT_KEYS.length; i++) {
            const roll = await new Roll("1d10").evaluate();
            const row = roleData.statTemplates[roll.total - 1];
            state.stats[STAT_KEYS[i]] = row[i];
            rolls.push(roll.total);
          }
          await new Roll("0").toMessage({
            flavor: `${game.i18n.localize(roleData.nameKey)} — Edgerunner Stat Rolls: [${rolls.join(", ")}]`
          });
          this._rollResult = rolls;
        }

        app.render(true);
      });
    }

    html.querySelectorAll(".crw-stat-cell-value").forEach(input => {
      input.addEventListener("change", (e) => {
        const key = e.target.dataset.stat;
        const val = parseInt(e.target.value) || 2;
        state.stats[key] = Math.max(1, Math.min(10, val));
        app.render(true);
      });
    });
  }

  validate(state) {
    if (state.method === "complete") {
      const spent = STAT_KEYS.reduce((sum, k) => sum + state.stats[k], 0);
      return spent === TOTAL_POINTS && STAT_KEYS.every(k => state.stats[k] >= MIN_STAT && state.stats[k] <= MAX_STAT);
    }
    return STAT_KEYS.every(k => state.stats[k] > 0);
  }

  serialize(html, state) {
    if (state.method !== "complete") {
      html.querySelectorAll(".crw-stat-cell-value").forEach(input => {
        const key = input.dataset.stat;
        state.stats[key] = parseInt(input.value) || state.stats[key];
      });
    }
    return state;
  }
}
