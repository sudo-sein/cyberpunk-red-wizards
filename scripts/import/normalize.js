// Raw pasted text -> array of clean lines. Strips the residual "▶ Armor" junk
// block left over from an adjacent card, drops watermark lines, collapses
// whitespace. Returns { lines, warnings }.
import { armorKeywordList } from "./tokenize.js";

// Zero-width / soft-hyphen / non-character format codes that PDF copy inserts
// at hyphenation breaks (e.g. "Incen" + U+FFFE + "diary" -> "Incendiary").
// Code points: soft hyphen, ZWSP/ZWNJ/ZWJ, word joiner, BOM, non-characters.
const FORMAT_CODES = new Set([0x00ad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0xfffe, 0xffff]);

function stripFormatChars(line) {
  let out = "";
  for (const ch of line) {
    if (!FORMAT_CODES.has(ch.codePointAt(0))) out += ch;
  }
  return out;
}

export function normalize(text, map) {
  const warnings = [];

  let lines = text.split("\n")
    .map(l => stripFormatChars(l))
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  let full = lines.join("\n");

  full = stripJunkArmorBlock(full, map);

  lines = full.split("\n").map(l => l.trim()).filter(Boolean);

  // Drop watermark lines: a lone lowercase word (no spaces, no digits).
  lines = lines.filter(l => {
    if (/^\p{Ll}[\p{Ll}'’-]*$/u.test(l)) {
      warnings.push({ section: "normalize", message: `Dropped watermark line "${l}"` });
      return false;
    }
    return true;
  });

  return { lines, warnings };
}

// Remove everything from the junk "▶ Armor" marker up to the SECOND armor
// label (the real card's armor block). Matching is case-insensitive so OCR
// casing on the marker ("▶ ARmoR") or labels still resolves. Indices come from
// a lowercased mirror but slices apply to the original text.
function stripJunkArmorBlock(full, map) {
  const lower = full.toLowerCase();
  const marker = map.labels.junkArmorMarker;
  const markerIdx = lower.indexOf(marker.toLowerCase());
  if (markerIdx === -1) return full;

  const positions = [];
  for (const label of armorKeywordList(map.labels)) {
    const labelLower = label.toLowerCase();
    let idx = lower.indexOf(labelLower, markerIdx + marker.length);
    while (idx !== -1) { positions.push(idx); idx = lower.indexOf(labelLower, idx + labelLower.length); }
  }
  positions.sort((a, b) => a - b);

  const cutEnd = positions.length >= 2
    ? positions[1]
    : findNextSectionStart(lower, markerIdx + marker.length, map.sectionHeaders);
  if (cutEnd === -1) return full;
  return full.slice(0, markerIdx) + full.slice(cutEnd);
}

function findNextSectionStart(lowerText, fromIdx, headers) {
  let earliest = -1;
  for (const key of Object.keys(headers)) {
    const idx = lowerText.indexOf(headers[key].toLowerCase(), fromIdx);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) earliest = idx;
  }
  return earliest;
}
