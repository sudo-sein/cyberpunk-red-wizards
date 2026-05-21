import { STAT_KEYS } from "../constants.js";

export function calculateHP(body, will) {
  return 10 + 5 * Math.ceil((body + will) / 2);
}

export function calculateSeriousWound(hp) {
  return Math.ceil(hp / 2);
}

export function calculateHumanity(emp) {
  return emp * 10;
}

export function calculateCurrentEmp(humanity) {
  return Math.ceil(humanity / 10);
}

export function calculateWalk(move) {
  return move * 2;
}

export function calculateRun(move) {
  return move * 4;
}

export function buildStatsData(stats) {
  const out = {};
  for (const key of STAT_KEYS) {
    const value = stats[key];
    out[key] = { value };
    if (key === "luck" || key === "emp") {
      out[key].max = value;
    }
  }
  return out;
}

export function calculateAllDerived(stats) {
  const hp = calculateHP(stats.body, stats.will);
  const humanity = calculateHumanity(stats.emp);
  return {
    hp,
    seriousWound: calculateSeriousWound(hp),
    deathSave: stats.body,
    humanity,
    currentEmp: calculateCurrentEmp(humanity),
    walk: calculateWalk(stats.move),
    run: calculateRun(stats.move),
  };
}
