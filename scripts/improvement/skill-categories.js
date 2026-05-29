export function categoryLabelKey(category) {
  const mapped = CONFIG?.CPR?.skillCategories?.[category];
  if (mapped) return mapped;
  if (category === "rangedweaponSkills") return "CPR.global.skillCategories.rangedWeaponSkills";
  return `CPR.global.skillCategories.${category}`;
}
