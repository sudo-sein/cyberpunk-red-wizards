const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];

export function validateStatsComplete(stats) {
  const sum = STAT_KEYS.reduce((acc, k) => acc + (stats[k] ?? 0), 0);
  const allInRange = STAT_KEYS.every(k => stats[k] >= 2 && stats[k] <= 8);
  return { valid: sum === 62 && allInRange, sum, allInRange };
}

export function validateStatsRolled(stats) {
  return { valid: STAT_KEYS.every(k => stats[k] > 0) };
}

export function validateSkillsPointBuy(skills, totalPoints = 86) {
  let spent = 0;
  let allMinimums = true;
  let allMaximums = true;

  for (const skill of skills) {
    const cost = skill.difficulty === "x2" ? skill.level * 2 : skill.level;
    spent += cost;
    if (skill.level < 2) allMinimums = false;
    if (skill.level > 6) allMaximums = false;
  }

  return { valid: spent === totalPoints && allMinimums && allMaximums, spent, allMinimums, allMaximums };
}

export function validateHumanity(humanity, humanityLoss) {
  return { valid: (humanity - humanityLoss) > 0, remaining: humanity - humanityLoss };
}

export function runFullChecklist(state) {
  const checks = [];

  if (state.method === "complete") {
    const statsResult = validateStatsComplete(state.stats);
    checks.push({ id: "stats", label: "crw.validation.stats", passed: statsResult.valid });
  } else {
    const statsResult = validateStatsRolled(state.stats);
    checks.push({ id: "stats", label: "crw.validation.stats", passed: statsResult.valid });
  }

  if (state.method !== "streetrat") {
    const skillsResult = validateSkillsPointBuy(state.skills);
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
