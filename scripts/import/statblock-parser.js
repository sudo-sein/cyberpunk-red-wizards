import { normalize } from "./normalize.js";
import { sectionize } from "./sectionizer.js";
import {
  parseStats, parseVitals, parseArmor, parseWeapons, parseSkills, parseEquipment,
} from "./parse-sections.js";
import { addCyberware } from "./resolver.js";

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
    tier: "competent",
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
  template.role = skillsResult.role;
  warnings.push(...skillsResult.warnings);

  const equipResult = parseEquipment(sections.equipment, map);
  template.equipment = equipResult.equipment;
  for (const c of equipResult.cyberware) addCyberware(cyberware, c.packName, c.itemName);
  warnings.push(...equipResult.warnings);

  template.cyberware = cyberware;
  template.tier = deriveTier(template.hp);

  return { template, errors, warnings };
}

function deriveTier(hp) {
  if (hp <= 25) return "amateur";
  if (hp <= 35) return "competent";
  if (hp <= 40) return "elite";
  if (hp <= 55) return "mini-boss";
  return "nightmare-boss";
}
