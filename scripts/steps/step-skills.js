import StepBase from "./step-base.js";
import { loadRole } from "../data/role-loader.js";

const MODULE_PATH = "modules/cyberpunk-red-wizards";
const TOTAL_POINTS = 86;
const MAX_LEVEL = 6;

const CATEGORY_ORDER = [
  "awarenessSkills", "bodySkills", "controlSkills", "educationSkills",
  "fightingSkills", "performanceSkills", "rangedWeaponSkills",
  "socialSkills", "techniqueSkills"
];

let allSkillsCache = null;

async function loadAllSkills() {
  if (allSkillsCache) return allSkillsCache;
  const resp = await fetch(`${MODULE_PATH}/data/all-skills.json`);
  if (!resp.ok) throw new Error("Failed to load all-skills.json");
  const data = await resp.json();
  const flat = [];
  for (const [category, skills] of Object.entries(data)) {
    for (const s of skills) {
      flat.push({ ...s, category, level: 0 });
    }
  }
  allSkillsCache = flat;
  return flat;
}

export default class StepSkills extends StepBase {
  constructor() {
    super("skills", "crw.steps.skills");
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
      const allSkills = await loadAllSkills();
      state.skills = allSkills.map(s => ({ ...s }));

      if (state.method === "edgerunner") {
        const roleData = await loadRole(state.role.id);
        if (roleData?.skills) {
          const roleMap = new Map(roleData.skills.map(s => [s.name, s]));
          for (const skill of state.skills) {
            const rs = roleMap.get(skill.name);
            if (rs) skill.level = 2;
          }
        }
      }
    }

    const spent = this._calculateSpent(state.skills);
    const grouped = this._groupByCategory(state.skills);

    return {
      remaining: TOTAL_POINTS - spent,
      spentPercent: Math.min(100, Math.round((spent / TOTAL_POINTS) * 100)),
      showFilter: true,
      categories: grouped,
    };
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
        if (skill.level > 0) {
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
    return spent === TOTAL_POINTS && state.skills.every(s => s.level >= 0 && s.level <= MAX_LEVEL);
  }

  serialize(html, state) {
    return state;
  }
}
