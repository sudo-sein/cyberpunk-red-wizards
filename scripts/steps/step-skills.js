import StepBase from "./step-base.js";
import { loadRole, fetchCompendiumItems } from "../data/role-loader.js";

const TOTAL_POINTS = 86;
const MIN_LEVEL = 2;
const MAX_LEVEL = 6;

const CATEGORY_ORDER = [
  "awarenessSkills", "bodySkills", "controlSkills", "educationSkills",
  "fightingSkills", "performanceSkills", "rangedWeaponSkills",
  "socialSkills", "techniqueSkills"
];

export default class StepSkills extends StepBase {
  constructor() {
    super("skills", "crw.steps.skills");
    this._compendiumSkills = null;
  }

  get template() {
    return null;
  }

  getTemplate(state) {
    if (state.method === "streetrat") {
      return "modules/cyberpunk-red-wizards/templates/steps/skills-fixed.hbs";
    }
    return "modules/cyberpunk-red-wizards/templates/steps/skills-pointbuy.hbs";
  }

  async prepareContext(state) {
    if (state.method === "streetrat") {
      return this._prepareFixed(state);
    }
    return this._preparePointBuy(state);
  }

  async _prepareFixed(state) {
    if (state.skills.length === 0) {
      const roleData = await loadRole(state.role.id);
      if (roleData?.skills) {
        state.skills = roleData.skills.map(s => ({
          name: s.name,
          level: s.fixedLevel,
          stat: s.stat,
          category: s.category,
          difficulty: s.difficulty,
        }));
      }
    }
    return {
      skills: state.skills.map(s => ({ name: s.name, level: s.level })),
    };
  }

  async _preparePointBuy(state) {
    if (state.skills.length === 0) {
      if (state.method === "edgerunner") {
        const roleData = await loadRole(state.role.id);
        if (roleData?.skills) {
          state.skills = roleData.skills.map(s => ({
            name: s.name,
            level: MIN_LEVEL,
            stat: s.stat,
            category: s.category,
            difficulty: s.difficulty,
          }));
        }
      } else {
        await this._loadCompendiumSkills(state);
      }
    }

    const spent = this._calculateSpent(state.skills);
    const grouped = this._groupByCategory(state.skills);

    return {
      remaining: TOTAL_POINTS - spent,
      spentPercent: Math.min(100, Math.round((spent / TOTAL_POINTS) * 100)),
      showFilter: state.method === "complete",
      categories: grouped,
    };
  }

  async _loadCompendiumSkills(state) {
    if (!this._compendiumSkills) {
      const packNames = [
        "core_skills-awareness", "core_skills-body", "core_skills-control",
        "core_skills-education", "core_skills-fighting", "core_skills-performance",
        "core_skills-ranged-weapon", "core_skills-social", "core_skills-technique"
      ];
      const allSkills = [];
      for (const packName of packNames) {
        const items = await fetchCompendiumItems(packName);
        for (const item of items) {
          allSkills.push({
            name: item.name,
            level: MIN_LEVEL,
            stat: item.system?.stat ?? "",
            category: item.system?.category ?? "",
            difficulty: item.system?.difficulty ?? "typical",
          });
        }
      }
      this._compendiumSkills = allSkills;
    }
    state.skills = this._compendiumSkills.map(s => ({ ...s }));
  }

  _calculateSpent(skills) {
    let spent = 0;
    for (const skill of skills) {
      spent += skill.difficulty === "x2" ? skill.level * 2 : skill.level;
    }
    return spent;
  }

  _groupByCategory(skills) {
    const groups = new Map();
    for (const cat of CATEGORY_ORDER) {
      groups.set(cat, []);
    }
    for (const skill of skills) {
      const cat = skill.category || "educationSkills";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push({
        name: skill.name,
        stat: skill.stat.toUpperCase(),
        level: skill.level,
        isX2: skill.difficulty === "x2",
      });
    }

    const result = [];
    for (const [cat, catSkills] of groups) {
      if (catSkills.length === 0) continue;
      catSkills.sort((a, b) => a.name.localeCompare(b.name));
      result.push({
        id: cat,
        label: game.i18n.localize(`crw.skills.category.${cat}`),
        skills: catSkills,
      });
    }
    return result;
  }

  activate(html, state, app) {
    if (state.method === "streetrat") return;

    html.querySelectorAll("[data-action='skillInc']").forEach(btn => {
      btn.addEventListener("click", () => {
        const skillName = btn.dataset.skill;
        const skill = state.skills.find(s => s.name === skillName);
        if (!skill) return;
        const cost = skill.difficulty === "x2" ? 2 : 1;
        const spent = this._calculateSpent(state.skills);
        if (skill.level < MAX_LEVEL && (spent + cost) <= TOTAL_POINTS) {
          skill.level++;
          app.render(true);
        }
      });
    });

    html.querySelectorAll("[data-action='skillDec']").forEach(btn => {
      btn.addEventListener("click", () => {
        const skillName = btn.dataset.skill;
        const skill = state.skills.find(s => s.name === skillName);
        if (!skill) return;
        if (skill.level > MIN_LEVEL) {
          skill.level--;
          app.render(true);
        }
      });
    });

    const filterInput = html.querySelector(".crw-skill-filter");
    if (filterInput) {
      filterInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        html.querySelectorAll(".crw-skill-row").forEach(row => {
          const name = row.querySelector(".crw-skill-name")?.textContent.toLowerCase() ?? "";
          row.style.display = name.includes(query) ? "" : "none";
        });
        html.querySelectorAll(".crw-skill-category").forEach(cat => {
          const visibleRows = cat.querySelectorAll(".crw-skill-row:not([style*='display: none'])");
          cat.style.display = visibleRows.length > 0 ? "" : "none";
        });
      });
    }
  }

  validate(state) {
    if (state.method === "streetrat") {
      return state.skills.length > 0;
    }
    const spent = this._calculateSpent(state.skills);
    const allMin = state.skills.every(s => s.level >= MIN_LEVEL);
    const allMax = state.skills.every(s => s.level <= MAX_LEVEL);
    return spent === TOTAL_POINTS && allMin && allMax;
  }

  serialize(html, state) {
    return state;
  }
}
