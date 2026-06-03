import { escapeRegExp, armorKeywordList, canonical, matchesHeader, stripLeadingHeader } from "./tokenize.js";

// Clean lines -> named sections. A line opens a section ONLY when it starts
// with that section's marker (word-anchored, canonicalized so OCR casing and
// stray punctuation still match). Armor and weapons may repeat; they are
// collected as ordered arrays of blocks.
export function sectionize(lines, map) {
  const H = map.sectionHeaders;
  const L = map.labels;
  const armorKeywords = armorKeywordList(L);
  const statsRe = buildStatsRegex(H.stats);

  const sections = { stats: [], vitals: [], armor: [], weapons: [], skills: [], roleAbility: [], equipment: [] };
  let current = null;

  for (const line of lines) {
    if (statsRe.test(canonical(line))) { current = sections.stats; current.push(line); continue; }
    if (matchesHeader(line, H.hp)) { current = sections.vitals; current.push(line); continue; }
    if (isArmorOpener(line, armorKeywords)) {
      const block = []; sections.armor.push(block); current = block; current.push(line); continue;
    }
    if (matchesHeader(line, L.weaponsKeyword)) {
      const block = []; sections.weapons.push(block); current = block;
      const rest = stripLeadingHeader(line, L.weaponsKeyword);
      if (rest) current.push(rest);
      continue;
    }
    if (matchesHeader(line, H.skills)) { current = sections.skills; current.push(line); continue; }
    if (H.roleAbility && matchesHeader(line, H.roleAbility)) { current = sections.roleAbility; current.push(line); continue; }
    if (matchesHeader(line, H.equipment)) { current = sections.equipment; current.push(line); continue; }
    // Any other line that starts with the section bullet is an unknown section
    // header: close the current section so its content does not bleed.
    if (line.startsWith("▶")) { current = null; continue; }
    if (current) current.push(line);
  }
  return sections;
}

// An armor line opens an armor block (e.g. "Armor: M Armorjack" or, on PL
// cards, "Pancerz: Kevlar®"). Matched case-insensitively on the literal
// keyword (colon included) so OCR letter-casing is tolerated while a
// keyword-less line like "Armor Piercing Rifle Ammo" is NOT treated as armor.
function isArmorOpener(line, armorKeywords) {
  const lower = line.toLowerCase();
  return armorKeywords.some(k => lower.startsWith(k.toLowerCase()));
}

// Match the stats header tolerantly: requires the five stat words in order
// anywhere in the canonicalized line (handles dropped "▶" and OCR casing).
function buildStatsRegex(statsHeader) {
  const tokens = canonical(statsHeader).split(" ").filter(Boolean);
  return new RegExp(tokens.map(escapeRegExp).join(".*"), "i");
}
