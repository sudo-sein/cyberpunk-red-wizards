import { normalize } from "./normalize.js";
import { sectionize } from "./sectionizer.js";
import {
  parseStats, parseVitals, parseArmor, parseWeapons, parseSkills, parseEquipment, parseRoleAbility,
} from "./parse-sections.js";
import { addCyberware } from "./resolver.js";
import { UNCATEGORIZED } from "../data/npc-categories.js";
import { CORE_IMPORT_SECTIONS } from "../constants.js";

const MODULE_PATH = "modules/cyberpunk-red-wizards";

let mapCache = {};

async function loadMap(language) {
  if (mapCache[language]) return mapCache[language];
  const path = `${MODULE_PATH}/data/import-maps/${language}.json`;
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load import map: ${path}`);
  mapCache[language] = await response.json();
  return mapCache[language];
}

export async function parseStatblock(text, language = "en") {
  const map = await loadMap(language);

  const template = {
    id: foundry.utils.randomID(),
    name: "Imported NPC",
    nameKey: null,
    tier: UNCATEGORIZED,
    source: "imported",
    stats: { int: 0, ref: 0, dex: 0, tech: 0, cool: 0, will: 0, luck: 0, move: 0, body: 0, emp: 0 },
    hp: 0,
    seriousWound: 0,
    deathSave: 0,
    armor: { head: null, body: null, alternatives: [] },
    weapons: [],
    weaponAlternatives: [],
    skills: [],
    equipment: [],
    cyberware: [],
    role: null,
  };

  const errors = [];
  const warnings = [];

  const { lines, warnings: normWarnings } = normalize(text, map);
  warnings.push(...normWarnings);

  const sections = sectionize(lines, map);

  const statsResult = parseStats(sections.stats);
  template.stats = statsResult.stats;
  warnings.push(...statsResult.warnings);

  const vitals = parseVitals(sections.vitals);
  template.hp = vitals.hp;
  template.seriousWound = vitals.seriousWound;
  template.deathSave = vitals.deathSave;

  const armor = parseArmor(sections.armor, map);
  template.armor = armor;

  const weaponsResult = parseWeapons(sections.weapons, map);
  template.weapons = weaponsResult.weapons;
  template.weaponAlternatives = weaponsResult.weaponAlternatives;
  errors.push(...weaponsResult.errors);

  const cyberware = [];
  for (const c of weaponsResult.cyberware) addCyberware(cyberware, c.packName, c.itemName);

  const skillsResult = parseSkills(sections.skills, map);
  template.skills = skillsResult.skills;
  warnings.push(...skillsResult.warnings);

  // Role comes from the dedicated "▶ Role Ability" section (e.g. Combat
  // Awareness 6 -> Solo rank 6); fall back to a role ability inlined in the
  // skills list. A sidebar role label like "(Solo)" is stray OCR and ignored.
  template.role = parseRoleAbility(sections.roleAbility, map) ?? skillsResult.role;

  const equipResult = parseEquipment(sections.equipment, map);
  template.equipment = [...(weaponsResult.equipment ?? []), ...equipResult.equipment];
  for (const c of equipResult.cyberware) addCyberware(cyberware, c.packName, c.itemName);
  warnings.push(...equipResult.warnings);

  template.cyberware = cyberware;

  const diagnostics = buildDiagnostics(template);
  warnings.push(...diagnostics.warnings);

  return { template, errors, warnings, diagnostics: diagnostics.report };
}

// Detect which expected sections actually produced data and warn on the gaps.
// The expected core set is {stats, vitals, armor, weapons, skills}; gear
// (equipment/cyberware) is optional and never scored or warned.
function buildDiagnostics(template) {
  const warnings = [];
  const found = {
    stats: Object.values(template.stats).some(v => v > 0),
    vitals: !(template.hp === 0 && template.seriousWound === 0 && template.deathSave === 0),
    armor: !!template.armor.head,
    weapons: template.weapons.length > 0,
    skills: template.skills.length > 0,
  };
  if (!found.vitals) warnings.push({ section: "vitals", message: "No Hit Points / vitals parsed" });
  if (!found.armor) warnings.push({ section: "armor", message: "No armor parsed" });
  if (!found.weapons) warnings.push({ section: "weapons", message: "No weapons parsed" });
  if (!found.skills) warnings.push({ section: "skills", message: "No skills parsed" });

  const report = {
    sections: { ...found, equipment: template.equipment.length > 0 || template.cyberware.length > 0 },
    score: { found: CORE_IMPORT_SECTIONS.filter(k => found[k]).length, total: CORE_IMPORT_SECTIONS.length },
  };
  return { warnings, report };
}
