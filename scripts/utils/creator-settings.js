import {
  MODULE_ID,
  DEFAULT_STAT_POINT_BUDGET,
  DEFAULT_SKILL_POINT_BUDGET,
} from "../constants.js";

function normalizeBudget(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function getStatPointBudget() {
  const configured = globalThis.game?.settings?.get?.(MODULE_ID, "statPointBudget");
  return normalizeBudget(configured, DEFAULT_STAT_POINT_BUDGET);
}

export function getSkillPointBudget() {
  const configured = globalThis.game?.settings?.get?.(MODULE_ID, "skillPointBudget");
  return normalizeBudget(configured, DEFAULT_SKILL_POINT_BUDGET);
}

export function getCreatorPointBudgets() {
  return {
    statPointBudget: getStatPointBudget(),
    skillPointBudget: getSkillPointBudget(),
  };
}
