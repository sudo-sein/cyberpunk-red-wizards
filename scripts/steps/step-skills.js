import StepBase from "./step-base.js";
import { loadRole } from "../data/role-loader.js";
import { getSkillPointBudget } from "../utils/creator-settings.js";

const MODULE_PATH = "modules/cyberpunk-red-wizards";
const MAX_LEVEL = 6;
const BASELINE_SKILL_LEVEL = 2;
const REQUIRED_BASELINE_SKILLS = new Set([
  "Athletics",
  "Brawling",
  "Concentration",
  "Conversation",
  "Education",
  "Evasion",
  "First Aid",
  "Human Perception",
  "Language (Streetslang)",
  "Local Expert",
  "Perception",
  "Persuasion",
  "Stealth",
]);

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
    }

    if (this._usesRequiredBaselineSkills(state)) {
      for (const skill of state.skills) {
        if (REQUIRED_BASELINE_SKILLS.has(skill.name) && skill.level < BASELINE_SKILL_LEVEL) {
          skill.level = BASELINE_SKILL_LEVEL;
        }
      }
    }

    const spent = this._calculateSpent(state.skills);
    const grouped = this._groupByCategory(state.skills);
    const totalPoints = getSkillPointBudget();

    return {
      totalPoints,
      remaining: totalPoints - spent,
      spentPercent: totalPoints > 0 ? Math.min(100, Math.round((spent / totalPoints) * 100)) : 0,
      hint: game.i18n.format("crw.skills.hint", { totalPoints }),
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

  _usesRequiredBaselineSkills(state) {
    return state.method === "edgerunner" || state.method === "complete";
  }

  _getMinimumSkillLevel(state, skillName) {
    if (this._usesRequiredBaselineSkills(state) && REQUIRED_BASELINE_SKILLS.has(skillName)) {
      return BASELINE_SKILL_LEVEL;
    }
    return 0;
  }

  _validateRequiredBaselineSkills(state) {
    if (!this._usesRequiredBaselineSkills(state)) return true;

    const levelsByName = new Map(state.skills.map(skill => [skill.name, skill.level]));
    for (const requiredSkill of REQUIRED_BASELINE_SKILLS) {
      if ((levelsByName.get(requiredSkill) ?? -1) < BASELINE_SKILL_LEVEL) return false;
    }
    return true;
  }

  activate(html, state, app) {
    if (state.method === "streetrat") return;
    const totalPoints = getSkillPointBudget();

    html.querySelectorAll("[data-action='skillDec']").forEach(btn => {
      const skillName = btn.dataset.skill;
      const skill = state.skills.find(s => s.name === skillName);
      if (!skill) return;
      btn.disabled = skill.level <= this._getMinimumSkillLevel(state, skill.name);
    });

    html.querySelectorAll("[data-action='skillInc']").forEach(btn => {
      btn.addEventListener("click", () => {
        const skillName = btn.dataset.skill;
        const skill = state.skills.find(s => s.name === skillName);
        if (!skill) return;
        const cost = skill.difficulty === "x2" ? 2 : 1;
        const spent = this._calculateSpent(state.skills);
        if (skill.level < MAX_LEVEL && (spent + cost) <= totalPoints) {
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
        const minLevel = this._getMinimumSkillLevel(state, skill.name);
        if (skill.level > minLevel) {
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
    return (
      spent === getSkillPointBudget() &&
      state.skills.every(s => s.level >= 0 && s.level <= MAX_LEVEL) &&
      this._validateRequiredBaselineSkills(state)
    );
  }

  serialize(html, state) {
    return state;
  }
}
