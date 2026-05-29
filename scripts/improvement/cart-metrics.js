export function plannedChangeCount(cart) {
  const skills = Array.from(cart?.skills?.values?.() ?? []).reduce((sum, delta) => sum + Math.max(0, Number(delta) || 0), 0);
  const roles = Array.from(cart?.roles?.values?.() ?? []).reduce((sum, delta) => sum + Math.max(0, Number(delta) || 0), 0);
  const newRoles = Array.from(cart?.newRoles?.values?.() ?? [])
    .reduce((sum, entry) => sum + Math.max(0, Number(entry?.plannedRank) || 0), 0);

  return skills + roles + newRoles;
}
