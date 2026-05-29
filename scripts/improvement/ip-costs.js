// Pure functions — no Foundry globals. Costs follow Cyberpunk RED Core, p. 134.

export function skillCost(nextLevel, difficulty) {
  const multiplier = difficulty === "difficult" ? 40 : 20;
  return multiplier * nextLevel;
}

export function roleCost(nextRank) {
  return 60 * nextRank;
}

export function cumulativeSkillCost(currentLevel, delta, difficulty) {
  let sum = 0;
  for (let i = 1; i <= delta; i++) sum += skillCost(currentLevel + i, difficulty);
  return sum;
}

export function cumulativeRoleCost(currentRank, delta) {
  let sum = 0;
  for (let i = 1; i <= delta; i++) sum += roleCost(currentRank + i);
  return sum;
}
