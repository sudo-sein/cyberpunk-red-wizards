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
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const errors = [];
  const warnings = [];

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

  const fullText = lines.join("\n");
  const headers = map.sectionHeaders;

  // Parse stats
  const statsIdx = fullText.indexOf(headers.stats);
  if (statsIdx !== -1) {
    const afterStats = fullText.slice(statsIdx + headers.stats.length);
    const nums = afterStats.match(/[\d]+/g);
    if (nums && nums.length >= 10) {
      const n = nums.map(Number);
      template.stats = { int: n[0], ref: n[1], dex: n[2], tech: n[3], cool: n[4], will: n[5], luck: 0, move: n[7], body: n[8], emp: n[9] };
    } else if (nums && nums.length >= 5) {
      const n = nums.map(Number);
      template.stats.int = n[0]; template.stats.ref = n[1]; template.stats.dex = n[2]; template.stats.tech = n[3]; template.stats.cool = n[4];
      errors.push({ section: "stats", message: `Only parsed ${nums.length} stats, expected 10` });
    }
  }

  // Parse HP
  const hpIdx = fullText.indexOf(headers.hp);
  if (hpIdx !== -1) {
    const afterHp = fullText.slice(hpIdx + headers.hp.length);
    const nums = afterHp.match(/[\d]+/g);
    if (nums && nums.length >= 3) {
      template.hp = Number(nums[0]);
      template.seriousWound = Number(nums[1]);
      template.deathSave = Number(nums[2]);
    }
  }

  // Parse armor blocks (may have multiple = alternatives)
  const armorKeyword = language === "pl" ? "Pancerz:" : "Armor:";
  const headSpRegex = language === "pl" ? /Głowa\s+OB\s+(\d+)/i : /Head\s+(\d+)\s*SP/i;
  const bodySpRegex = language === "pl" ? /Ciało\s+OB\s+(\d+)/i : /Body\s+(\d+)\s*SP/i;

  const armorSections = [];
  let searchFrom = 0;
  while (true) {
    const idx = fullText.indexOf(armorKeyword, searchFrom);
    if (idx === -1) break;
    const nextSection = findNextSectionStart(fullText, idx + armorKeyword.length, headers);
    const block = fullText.slice(idx, nextSection === -1 ? undefined : nextSection);
    armorSections.push(block);
    searchFrom = idx + armorKeyword.length;
  }

  for (let i = 0; i < armorSections.length; i++) {
    const block = armorSections[i];
    const armorNameMatch = block.match(language === "pl" ? /Pancerz:\s*(.+)/ : /Armor:\s*(.+)/);
    const armorName = armorNameMatch ? armorNameMatch[1].trim() : "Unknown";
    const headMatch = block.match(headSpRegex);
    const bodyMatch = block.match(bodySpRegex);
    const headSp = headMatch ? Number(headMatch[1]) : 0;
    const bodySp = bodyMatch ? Number(bodyMatch[1]) : 0;

    const mapped = map.armor[armorName] ?? map.armor[armorName.replace("®", "")];
    const headItem = mapped ? mapped.head : armorName;
    const bodyItem = mapped ? mapped.body : armorName;
    const packName = "core_armor";

    const entry = {
      head: { name: armorName, sp: headSp, packName, itemName: headItem },
      body: { name: armorName, sp: bodySp, packName, itemName: bodyItem },
    };

    if (i === 0) {
      template.armor.head = entry.head;
      template.armor.body = entry.body;
    } else {
      template.armor.alternatives.push(entry);
    }
  }

  // Parse weapon blocks (may have multiple after each Armor block)
  const weaponKeyword = language === "pl" ? "Uzbrojenie" : "Weapons";
  const weaponGroups = [];
  searchFrom = 0;
  while (true) {
    const idx = fullText.indexOf(weaponKeyword, searchFrom);
    if (idx === -1) break;
    const nextSection = findNextSectionStart(fullText, idx + weaponKeyword.length, headers);
    const block = fullText.slice(idx + weaponKeyword.length, nextSection === -1 ? undefined : nextSection).trim();
    const weaponLines = block.split("\n").map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith("▶") && !l.includes(armorKeyword));
    const parsed = weaponLines.map(line => parseWeaponLine(line, map, errors)).filter(Boolean);
    weaponGroups.push(parsed);
    searchFrom = idx + weaponKeyword.length;
  }

  if (weaponGroups.length > 0) template.weapons = weaponGroups[0];
  for (let i = 1; i < weaponGroups.length; i++) {
    template.weaponAlternatives.push(weaponGroups[i]);
  }

  // Parse skills
  const skillsIdx = fullText.indexOf(headers.skills);
  if (skillsIdx !== -1) {
    const nextSection = findNextSectionStart(fullText, skillsIdx + headers.skills.length, headers);
    const skillText = fullText.slice(skillsIdx + headers.skills.length, nextSection === -1 ? undefined : nextSection);
    const cleaned = skillText.replace(/umiejętności\s*/i, "").replace(/\n/g, " ").trim();
    const pairs = cleaned.split(/,\s*/);
    for (const pair of pairs) {
      const match = pair.trim().match(/^(.+?)\s+(\d+)$/);
      if (!match) continue;
      let skillName = match[1].trim();
      const base = Number(match[2]);
      const mapped = map.skills[skillName];
      if (mapped) {
        skillName = mapped;
      } else {
        const lower = skillName.toLowerCase();
        const found = Object.entries(map.skills).find(([k]) => k.toLowerCase() === lower);
        if (found) {
          skillName = found[1];
        } else {
          warnings.push({ section: "skills", message: `Unknown skill: "${skillName}" — kept as-is` });
        }
      }
      template.skills.push({ name: skillName, base });
    }
  }

  // Parse equipment/cyberware
  const equipIdx = fullText.indexOf(headers.equipment);
  if (equipIdx !== -1) {
    const equipText = fullText.slice(equipIdx + headers.equipment.length).trim();
    const items = equipText.split(/,\s*/);
    for (const item of items) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const qtyMatch = trimmed.match(/^(.+?)\s+x\s*(\d+)$/i) || trimmed.match(/^(.+?)\s*x(\d+)$/i);
      let name = qtyMatch ? qtyMatch[1].trim() : trimmed;
      const qty = qtyMatch ? Number(qtyMatch[2]) : 1;

      const ammoEntry = map.ammo?.[name];
      if (ammoEntry) {
        template.equipment.push({ ...ammoEntry, quantity: qty });
        continue;
      }

      const equipEntry = map.equipment?.[name];
      if (equipEntry) {
        if (equipEntry.packName === "core_cyberware") {
          template.cyberware.push({ packName: equipEntry.packName, itemName: equipEntry.itemName });
        } else {
          template.equipment.push({ ...equipEntry, quantity: qty });
        }
        continue;
      }

      const weaponEntry = map.weapons?.[name];
      if (weaponEntry) {
        template.cyberware.push({ packName: "core_cyberware", itemName: weaponEntry });
        continue;
      }

      warnings.push({ section: "equipment", message: `Unknown item: "${name}" — skipped` });
    }
  }

  // Auto-detect tier from HP
  if (template.hp <= 25) template.tier = "amateur";
  else if (template.hp <= 35) template.tier = "competent";
  else if (template.hp <= 40) template.tier = "elite";
  else if (template.hp <= 55) template.tier = "mini-boss";
  else template.tier = "nightmare-boss";

  return { template, errors, warnings };
}

function parseWeaponLine(line, map, errors) {
  let quality = "standard";
  let cleaned = line;

  for (const [prefix, q] of Object.entries(map.qualityPrefixes)) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      quality = q;
      cleaned = cleaned.slice(prefix.length).trim();
      break;
    }
  }

  const dmgMatch = cleaned.match(/(\d+d\d+)/);
  const damage = dmgMatch ? dmgMatch[1] : "";
  let weaponName = cleaned.replace(/\d+d\d+/, "").replace(/\d+k\d+/, "").trim();

  const mapped = map.weapons[weaponName];
  if (mapped) {
    weaponName = mapped;
  } else {
    const lower = weaponName.toLowerCase();
    const found = Object.entries(map.weapons).find(([k]) => k.toLowerCase() === lower);
    if (found) {
      weaponName = found[1];
    } else if (weaponName) {
      errors.push({ section: "weapons", message: `Unknown weapon: "${weaponName}"` });
    }
  }

  if (!weaponName) return null;
  return { packName: "core_weapons", itemName: weaponName, quality, damage };
}

function findNextSectionStart(text, fromIdx, headers) {
  let earliest = -1;
  for (const key of Object.keys(headers)) {
    const header = headers[key];
    const idx = text.indexOf(header, fromIdx);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx;
    }
  }
  const sepIdx = text.indexOf("----", fromIdx);
  if (sepIdx !== -1 && (earliest === -1 || sepIdx < earliest)) {
    earliest = sepIdx;
  }
  return earliest;
}
