// Pure, dependency-free string helpers for the statblock parser.

export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Split on `sep`, ignoring separators that appear inside parentheses.
export function splitTopLevel(str, sep = ",") {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Numbers from a stat line. Parenthetical penalties are removed first; a dash
// (— / – / -) counts as 0.
export function extractStatNumbers(line) {
  const stripped = line.replace(/\([^)]*\)/g, " ");
  const matches = stripped.match(/\d+|[—–-]/g) || [];
  return matches.map(t => (/[—–-]/.test(t) ? 0 : Number(t)));
}

// "Athletics 10 (8)" -> { name:"Athletics", level:10 }; "Athletics12" -> level 12;
// "Local Expert (Your Home) 6" -> name keeps the spec paren, level 6;
// "Tactics 12 hardened security officer" -> { name:"Tactics", level:12 } — the
//   last skill in a list often has the NPC name (no digits) bled onto the end;
//   trailing non-numeric text after the level is discarded.
// no trailing number -> level null.
export function splitNameAndLevel(seg) {
  const noPenalty = seg.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const m = noPenalty.match(/^(.*?)\s*(\d+)(?:\s+\D+)?$/);
  if (!m) return { name: noPenalty, level: null };
  return { name: m[1].trim(), level: Number(m[2]) };
}

// "Rifle Ammo x50" -> { name:"Rifle Ammo", quantity:50 }; default quantity 1.
export function parseQuantity(token) {
  const m = token.match(/^(.*?)\s*x\s*(\d+)\s*$/i);
  if (m) return { name: m[1].trim(), quantity: Number(m[2]) };
  return { name: token.trim(), quantity: 1 };
}

// Detect and strip a quality marker from a weapon name. English statblocks put
// the marker first ("Poor Quality Shotgun"); Polish puts it last ("Strzelba
// niskiej jakości"), so we strip a matching marker from either end.
export function stripQualityPrefix(name, qualityPrefixes) {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  for (const [marker, q] of Object.entries(qualityPrefixes || {})) {
    const m = marker.toLowerCase();
    if (lower.startsWith(m)) {
      return { name: trimmed.slice(marker.length).trim(), quality: q };
    }
    if (lower.endsWith(m)) {
      return { name: trimmed.slice(0, trimmed.length - marker.length).trim(), quality: q };
    }
  }
  return { name: trimmed, quality: "standard" };
}

// The armor label(s) a card may use. A map normally has a single armorKeyword,
// but PL cards mix the English junk-block keyword ("Armor:") with a localized
// real-armor keyword ("Pancerz:"), so a map may list several in armorKeywords.
export function armorKeywordList(labels) {
  return labels.armorKeywords ?? [labels.armorKeyword];
}

// Recover OCR-dropped commas: a ')' followed by whitespace then a capital
// letter is treated as an item boundary.
export function splitOnParenBoundary(str) {
  return str.replace(/\)\s+(?=[A-ZÀ-ſ])/g, "), ");
}

// Decorative/format code points PDF copy injects, plus the ▶ section bullet.
// U+00AD soft hyphen, U+200B zero-width space, U+200C ZWNJ, U+200D ZWJ,
// U+2060 word joiner, U+FEFF BOM/ZWNBSP, U+FFFE, U+FFFF, U+25B6 ▶.
const DECORATIVE = /[­​‌‍⁠﻿￾￿▶]/g;

// Fold a line for header matching: drop the ▶ bullet and decorative chars,
// lowercase, reduce to alphanumeric words separated by single spaces.
// "▶ CybeRwARe & sPeCiAl equiPment" -> "cyberware special equipment".
export function canonical(s) {
  return (s ?? "")
    .replace(DECORATIVE, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// True when `line` begins with `headerPhrase` on a word boundary, ignoring
// case, the ▶ bullet, and punctuation.
export function matchesHeader(line, headerPhrase) {
  const h = canonical(headerPhrase);
  if (!h) return false;
  const l = canonical(line);
  return l === h || l.startsWith(h + " ");
}

// Strip a leading header phrase from a line, case/punctuation tolerant, and
// return the remaining ORIGINAL text verbatim (downstream resolvers need the
// real casing/punctuation of item names). Non-matching lines are returned
// trimmed but otherwise unchanged.
export function stripLeadingHeader(line, headerPhrase) {
  const tokens = canonical(headerPhrase).split(" ").filter(Boolean);
  if (!tokens.length) return (line ?? "").trim();
  const sep = "[^\\p{L}\\p{N}]";
  const pattern = "^" + sep + "*" + tokens.map(escapeRegExp).join(sep + "+") + sep + "*";
  const re = new RegExp(pattern, "iu");
  return re.test(line) ? line.replace(re, "").trim() : (line ?? "").trim();
}

// Case-insensitive lookup in a plain string-keyed object.
export function ciGet(obj, name) {
  if (!obj || name == null) return undefined;
  if (obj[name] !== undefined) return obj[name];
  const lower = String(name).toLowerCase();
  const hit = Object.entries(obj).find(([k]) => k.toLowerCase() === lower);
  return hit ? hit[1] : undefined;
}
