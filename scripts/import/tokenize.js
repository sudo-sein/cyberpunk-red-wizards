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
// no trailing number -> level null.
export function splitNameAndLevel(seg) {
  const noPenalty = seg.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const m = noPenalty.match(/^(.*?)\s*(\d+)$/);
  if (!m) return { name: noPenalty, level: null };
  return { name: m[1].trim(), level: Number(m[2]) };
}

// "Rifle Ammo x50" -> { name:"Rifle Ammo", quantity:50 }; default quantity 1.
export function parseQuantity(token) {
  const m = token.match(/^(.*?)\s*x\s*(\d+)\s*$/i);
  if (m) return { name: m[1].trim(), quantity: Number(m[2]) };
  return { name: token.trim(), quantity: 1 };
}

// Detect and strip a leading quality prefix from a weapon name.
export function stripQualityPrefix(name, qualityPrefixes) {
  for (const [prefix, q] of Object.entries(qualityPrefixes || {})) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      return { name: name.slice(prefix.length).trim(), quality: q };
    }
  }
  return { name: name.trim(), quality: "standard" };
}

// Recover OCR-dropped commas: a ')' followed by whitespace then a capital
// letter is treated as an item boundary.
export function splitOnParenBoundary(str) {
  return str.replace(/\)\s+(?=[A-ZÀ-ſ])/g, "), ");
}
