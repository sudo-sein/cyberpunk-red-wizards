import {
  STAT_KEYS,
  DEFAULT_STAT_POINT_BUDGET,
  DEFAULT_SKILL_POINT_BUDGET,
} from "../constants.js";

export function validateStatsComplete(stats, totalPoints = DEFAULT_STAT_POINT_BUDGET) {
  const sum = STAT_KEYS.reduce((acc, k) => acc + (stats[k] ?? 0), 0);
  const allInRange = STAT_KEYS.every(k => stats[k] >= 2 && stats[k] <= 8);
  return { valid: sum === totalPoints && allInRange, sum, allInRange };
}

export function validateStatsRolled(stats) {
  return { valid: STAT_KEYS.every(k => stats[k] > 0) };
}

export function validateSkillsPointBuy(skills, totalPoints = DEFAULT_SKILL_POINT_BUDGET) {
  let spent = 0;
  let allInRange = true;

  for (const skill of skills) {
    const cost = skill.difficulty === "x2" ? skill.level * 2 : skill.level;
    spent += cost;
    if (skill.level < 0 || skill.level > 6) allInRange = false;
  }

  return { valid: spent === totalPoints && allInRange, spent, allInRange };
}

export function validateHumanity(humanity, humanityLoss) {
  return { valid: (humanity - humanityLoss) > 0, remaining: humanity - humanityLoss };
}

export function runFullChecklist(
  state,
  {
    statPointsTotal = DEFAULT_STAT_POINT_BUDGET,
    skillPointsTotal = DEFAULT_SKILL_POINT_BUDGET,
  } = {},
) {
  const checks = [];

  if (state.method === "complete") {
    const statsResult = validateStatsComplete(state.stats, statPointsTotal);
    checks.push({ id: "stats", label: "crw.validation.stats", passed: statsResult.valid });
  } else {
    const statsResult = validateStatsRolled(state.stats);
    checks.push({ id: "stats", label: "crw.validation.stats", passed: statsResult.valid });
  }

  if (state.method !== "streetrat") {
    const skillsResult = validateSkillsPointBuy(state.skills, skillPointsTotal);
    checks.push({ id: "skills", label: "crw.validation.skills", passed: skillsResult.valid });
  } else {
    checks.push({ id: "skills", label: "crw.validation.skills", passed: state.skills.length > 0 });
  }

  const totalHumanityLoss = (state.cyberware ?? []).reduce((sum, cw) => sum + (cw.humanityLoss ?? 0), 0);
  const humanityMax = state.stats.emp * 10;
  const humanityResult = validateHumanity(humanityMax, totalHumanityLoss);
  checks.push({ id: "humanity", label: "crw.validation.humanity", passed: humanityResult.valid });

  checks.push({ id: "role", label: "crw.validation.role", passed: !!state.role?.id });
  checks.push({ id: "handle", label: "crw.validation.handle", passed: state.handle.length > 0 });

  return checks;
}
