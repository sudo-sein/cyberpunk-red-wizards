import { escapeRegExp, armorKeywordList, canonical, matchesHeader, stripLeadingHeader } from "./tokenize.js";

// Public entry: pick a sectionizing strategy by layout, then return the named
// sections. Inline (single-line/blob) statblocks are re-lined first so the
// existing line-based logic can consume them.
export function sectionize(lines, map) {
  return isInline(lines, map) ? sectionizeInline(lines, map) : sectionizeLines(lines, map);
}

// True when sections are packed without line breaks: some single physical line
// carries >=2 distinct section headers. A normal line-broken paste has <=1.
function isInline(lines, map) {
  const headers = sectionHeaderPhrases(map).filter(Boolean).map(canonical);
  return lines.some(line => {
    const c = canonical(line);
    let hits = 0;
    for (const h of headers) {
      if (c.includes(h) && ++hits >= 2) return true;
    }
    return false;
  });
}

// Inline strategy: re-insert line breaks before recognized anchors, then run the
// line strategy on the result.
function sectionizeInline(lines, map) {
  return sectionizeLines(relineInline(lines, map), map);
}

// Existing line strategy: a line opens a section ONLY when it starts with that
// section's marker (word-anchored, canonicalized). Armor/weapons may repeat;
// collected as ordered arrays of blocks.
function sectionizeLines(lines, map) {
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

// ---- inline re-lining ------------------------------------------------------

// Re-line a blob: phase 1 breaks before each top-level section header; phase 2
// breaks the armor/weapons sub-blocks out of any non-skill segment (so a
// "Heavy Weapons" skill is never mis-split into a weapons block).
function relineInline(lines, map) {
  const phase1 = insertBreaks(lines.join(" "), sectionHeaderAnchors(map));
  const out = [];
  for (const seg of splitClean(phase1)) {
    if (isSkillLikeSegment(seg, map)) { out.push(seg); continue; }
    for (const sub of splitClean(insertBreaks(seg, armorBlockAnchors(map)))) out.push(sub);
  }
  return out;
}

function isSkillLikeSegment(seg, map) {
  const H = map.sectionHeaders;
  return matchesHeader(seg, H.skills)
    || (H.roleAbility && matchesHeader(seg, H.roleAbility))
    || matchesHeader(seg, H.equipment);
}

// Insert a newline before each anchor match. A leading break (index 0) is
// removed by splitClean.
function insertBreaks(text, patterns) {
  let out = text;
  for (const re of patterns) out = out.replace(re, "\n$&");
  return out;
}

function splitClean(text) {
  return text.split("\n").map(s => s.trim()).filter(Boolean);
}

// Anchor regexes for the top-level section headers: the header's canonical word
// sequence (internal ▶ bullets preserved), optionally preceded by a ▶ bullet,
// with non-alphanumeric runs between words.
function sectionHeaderAnchors(map) {
  return sectionHeaderPhrases(map).filter(Boolean).map(headerAnchorRe);
}

function headerAnchorRe(header) {
  const sep = "[^\\p{L}\\p{N}]";
  const tokens = canonical(header).split(" ").filter(Boolean).map(escapeRegExp);
  return new RegExp("(?:▶\\s*)?" + tokens.join(sep + "+"), "giu");
}

// Anchors that split an armor/weapons run: the armor keyword(s) (literal, colon
// preserved), the Weapons keyword (word-bounded), and the Head/Body SP lines.
function armorBlockAnchors(map) {
  const L = map.labels;
  const res = [];
  for (const k of armorKeywordList(L)) res.push(new RegExp(escapeRegExp(k), "gi"));
  res.push(new RegExp("\\b" + escapeRegExp(L.weaponsKeyword) + "\\b", "gi"));
  if (L.headSp) res.push(new RegExp(L.headSp, "gi"));
  if (L.bodySp) res.push(new RegExp(L.bodySp, "gi"));
  return res;
}

function sectionHeaderPhrases(map) {
  const H = map.sectionHeaders;
  return [H.stats, H.hp, H.skills, H.roleAbility, H.equipment];
}

// ---- shared helpers --------------------------------------------------------

// An armor line opens an armor block (e.g. "Armor: M Armorjack" or, on PL cards,
// "Pancerz: Kevlar®"). Matched case-insensitively on the literal keyword (colon
// included) so OCR letter-casing is tolerated while a keyword-less line like
// "Armor Piercing Rifle Ammo" is NOT treated as armor.
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
