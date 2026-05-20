import { escapeRegExp } from "./tokenize.js";

// Clean lines -> named sections. A line opens a section ONLY when it starts
// with that section's marker (line-anchored), so substrings like
// "Heavy Weapons" inside the skills list never trigger a weapons section.
// Armor and weapons may repeat; they are collected as ordered arrays of blocks.
export function sectionize(lines, map) {
  const H = map.sectionHeaders;
  const L = map.labels;
  const statsRe = buildStatsRegex(H.stats);

  const sections = { stats: [], vitals: [], armor: [], weapons: [], skills: [], roleAbility: [], equipment: [] };
  let current = null;

  for (const line of lines) {
    if (statsRe.test(line)) {
      current = sections.stats; current.push(line); continue;
    }
    if (line.startsWith(H.hp)) {
      current = sections.vitals; current.push(line); continue;
    }
    if (isArmorOpener(line, L.armorKeyword)) {
      const block = []; sections.armor.push(block); current = block; current.push(line); continue;
    }
    if (line === L.weaponsKeyword) {
      const block = []; sections.weapons.push(block); current = block; continue;
    }
    if (line.startsWith(H.skills)) {
      current = sections.skills; current.push(line); continue;
    }
    if (H.roleAbility && line.startsWith(H.roleAbility)) {
      current = sections.roleAbility; current.push(line); continue;
    }
    if (line.startsWith(H.equipment)) {
      current = sections.equipment; current.push(line); continue;
    }
    // Any other line that starts with the section bullet is an unknown section
    // header (e.g. "▶ Cyberdeck Programs"): close the current section so its
    // content does not bleed into the previous one.
    if (line.startsWith("▶")) { current = null; continue; }
    if (current) current.push(line);
  }
  return sections;
}

// After normalize strips the junk block, the only armor lines reaching the
// sectionizer start with the armor keyword (e.g. "Armor: M Armorjack").
function isArmorOpener(line, armorKeyword) {
  return line.startsWith(armorKeyword);
}

// Match the stats header tolerantly (some cards drop the leading "▶"):
// requires the five stat words in order anywhere in the line.
function buildStatsRegex(statsHeader) {
  const tokens = statsHeader.split("▶").map(s => s.trim()).filter(Boolean);
  return new RegExp(tokens.map(escapeRegExp).join(".*"), "i");
}
