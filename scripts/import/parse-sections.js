import { extractStatNumbers, splitTopLevel, splitNameAndLevel, splitOnParenBoundary, escapeRegExp } from "./tokenize.js";
import { resolveWeapon, resolveSkillOrRole, resolveEquipmentToken, addCyberware } from "./resolver.js";

const STATS1 = ["int", "ref", "dex", "tech", "cool"];
const STATS2 = ["will", "luck", "move", "body", "emp"];

export function parseStats(statLines) {
  const warnings = [];
  const stats = { int: 0, ref: 0, dex: 0, tech: 0, cool: 0, will: 0, luck: 0, move: 0, body: 0, emp: 0 };
  if (statLines.length === 0) {
    warnings.push({ section: "stats", message: "No stats section found" });
    return { stats, warnings };
  }
  let primary = extractStatNumbers(statLines[0]);
  let secondLine = statLines[1] ?? "";
  if (primary.length < 5 && statLines.length >= 2) {
    primary = extractStatNumbers(statLines[1]);
    secondLine = statLines[2] ?? "";
  }
  if (primary.length >= 5) STATS1.forEach((k, i) => { stats[k] = primary[i]; });
  else warnings.push({ section: "stats", message: "Could not parse INT/REF/DEX/TECH/COOL line" });

  const secondary = extractStatNumbers(secondLine);
  STATS2.forEach((k, i) => { stats[k] = secondary[i] ?? 0; });
  if (secondary.length < 5) {
    warnings.push({ section: "stats", message: `Second stat line had ${secondary.length} of 5 values; missing set to 0` });
  }
  return { stats, warnings };
}

export function parseVitals(vitalsLines) {
  const out = { hp: 0, seriousWound: 0, deathSave: 0 };
  const nums = (vitalsLines.join(" ").match(/\d+/g) || []).map(Number);
  if (nums.length >= 3) { out.hp = nums[0]; out.seriousWound = nums[1]; out.deathSave = nums[2]; }
  return out;
}

export function parseArmor(armorBlocks, map) {
  const L = map.labels;
  const headRe = new RegExp(L.headSp, "i");
  const bodyRe = new RegExp(L.bodySp, "i");

  const entries = armorBlocks.map(block => {
    const text = block.join(" ");
    const nameLine = block[0] ?? "";
    const armorName = nameLine.slice(nameLine.indexOf(L.armorKeyword) + L.armorKeyword.length).trim();
    const headSp = Number((text.match(headRe) || [])[1] ?? 0);
    const bodySp = Number((text.match(bodyRe) || [])[1] ?? 0);

    const mapped = map.armor[armorName] ?? map.armor[armorName.replace("®", "")];
    if (mapped && !mapped.head) {
      // SP comes from cyberware: emit slots with no packName.
      return { head: { name: armorName, sp: headSp || mapped.sp || 0 }, body: { name: armorName, sp: bodySp || mapped.sp || 0 } };
    }
    const headItem = mapped ? mapped.head : armorName;
    const bodyItem = mapped ? mapped.body : armorName;
    return {
      head: { name: armorName, sp: headSp, packName: "core_armor", itemName: headItem },
      body: { name: armorName, sp: bodySp, packName: "core_armor", itemName: bodyItem },
    };
  });

  return {
    head: entries[0]?.head ?? null,
    body: entries[0]?.body ?? null,
    alternatives: entries.slice(1),
  };
}

export function parseWeapons(weaponBlocks, map) {
  const errors = [];
  const groups = [];
  const cyberware = [];
  const equipment = [];

  for (const block of weaponBlocks) {
    const text = block.join(" ");
    const segments = splitWeaponSegments(text);
    const weapons = [];
    for (const seg of segments) {
      const { entries, errors: segErrors } = resolveWeapon(seg.name, seg.damage, map);
      for (const e of segErrors) errors.push(e);
      for (const e of entries) {
        if (e.kind === "cyberware") addCyberware(cyberware, e.packName, e.itemName);
        else if (e.kind === "equipment") equipment.push({ packName: e.packName, itemName: e.itemName, quantity: e.quantity ?? 1 });
        else weapons.push({ packName: e.packName, itemName: e.itemName, quality: e.quality, damage: e.damage });
      }
    }
    groups.push(weapons);
  }
  return {
    weapons: groups[0] ?? [],
    weaponAlternatives: groups.slice(1),
    cyberware,
    equipment,
    errors,
  };
}

// Split a joined weapons block into { name, damage } segments. Each weapon is
// "<name> <NdM>"; joining the whole block first means line-wrapped names
// (e.g. "Medium Melee" + "Weapon") are reunited before splitting on damage.
function splitWeaponSegments(text) {
  const dmgRegex = /\d+[dk]\d+/g;
  const segments = [];
  let lastIdx = 0;
  let m;
  while ((m = dmgRegex.exec(text)) !== null) {
    const name = text.slice(lastIdx, m.index).trim();
    if (name) segments.push({ name, damage: m[0] });
    lastIdx = dmgRegex.lastIndex;
  }
  return segments;
}

export function parseSkills(skillLines, map) {
  const warnings = [];
  const skills = [];
  let role = null;
  if (skillLines.length === 0) return { skills, role, warnings };

  let text = skillLines.join(" ");
  text = stripHeader(text, map.sectionHeaders.skills);
  for (const seg of splitTopLevel(text, ",")) {
    const { name, level } = splitNameAndLevel(seg);
    if (level === null) {
      if (name) warnings.push({ section: "skills", message: `Dropped segment without level: "${seg}"` });
      continue;
    }
    const r = resolveSkillOrRole(name, level, map);
    if (r.kind === "role") { role = r.role; continue; }
    if (!r.matched) warnings.push({ section: "skills", message: `Unknown skill: "${name}" — kept as-is` });
    skills.push(r.skill);
  }
  return { skills, role, warnings };
}

export function parseEquipment(equipLines, map) {
  const warnings = [];
  const equipment = [];
  const cyberware = [];
  if (equipLines.length === 0) return { equipment, cyberware, warnings };

  let text = equipLines.join(" ");
  text = stripHeader(text, map.sectionHeaders.equipment);
  text = splitOnParenBoundary(text);
  for (const token of splitTopLevel(text, ",")) {
    const res = resolveEquipmentToken(token, map);
    for (const w of res.warnings) warnings.push(w);
    for (const e of res.entries) {
      if (e.packName === "core_cyberware") addCyberware(cyberware, e.packName, e.itemName);
      else equipment.push({ packName: e.packName, itemName: e.itemName, quantity: e.quantity ?? 1 });
    }
  }
  return { equipment, cyberware, warnings };
}

function stripHeader(text, header) {
  const re = new RegExp("^.*?" + escapeRegExp(header) + "\\s*", "i");
  return text.replace(re, "").trim();
}
