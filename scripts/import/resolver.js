import { stripQualityPrefix, parseQuantity, splitTopLevel } from "./tokenize.js";

// --- shared lookup helpers ---------------------------------------------------
function ciValue(obj, name) {
  if (!obj) return undefined;
  if (obj[name] !== undefined) return obj[name];
  const lower = name.toLowerCase();
  const hit = Object.entries(obj).find(([k]) => k.toLowerCase() === lower);
  return hit ? hit[1] : undefined;
}

// True when a name resolves to a concrete item without any parenthetical
// splitting (used to short-circuit names whose canonical form contains parens).
function lookupDirect(name, map) {
  if (!name) return false;
  if (ciValue(map.popupWeapons, name) !== undefined) return true;
  if (ciValue(map.ammo, name) !== undefined) return true;
  if (ciValue(map.equipment, name) !== undefined) return true;
  if (ciValue(map.weapons, name) !== undefined) return true;
  return (map.cyberwareWeapons || []).some(c => c.toLowerCase() === name.toLowerCase());
}

export function addCyberware(list, packName, itemName) {
  if (list.some(c => c.itemName === itemName)) return;
  list.push({ packName, itemName });
}

// --- weapons -----------------------------------------------------------------
// Returns { entries:[{kind:"weapon"|"cyberware", ...}], errors:[] }.
// In the weapons context, cyberware entries carry no quantity.
export function resolveWeapon(rawName, damage, map) {
  const errors = [];

  // "Weapon w/ Upgrade" — the base is the weapon and each "with" clause is a
  // weapon upgrade that becomes a separate equipment item.
  const withParts = rawName.split(/\s+w\/\s+/i);
  if (withParts.length > 1) {
    const baseRes = resolveWeapon(withParts[0], damage, map);
    const entries = [...baseRes.entries];
    errors.push(...baseRes.errors);
    for (const acc of withParts.slice(1)) {
      const accName = acc.trim();
      const upgrade = ciValue(map.weaponUpgrades, accName);
      if (upgrade) entries.push({ kind: "equipment", packName: upgrade.packName, itemName: upgrade.itemName, quantity: 1 });
      else errors.push({ section: "weapons", message: `Unknown weapon upgrade: "${accName}"` });
    }
    return { entries, errors };
  }

  const { name: stripped, quality } = stripQualityPrefix(rawName, map.qualityPrefixes);
  const name = stripped.trim();
  if (!name) return { entries: [], errors };

  const popup = ciValue(map.popupWeapons, name);
  if (popup) {
    return {
      entries: [
        { kind: "weapon", packName: "core_weapons", itemName: popup.weapon, quality, damage },
        { kind: "cyberware", packName: "core_cyberware", itemName: popup.mount },
      ],
      errors,
    };
  }

  const upgrade = ciValue(map.weaponUpgrades, name);
  if (upgrade) {
    return { entries: [{ kind: "equipment", packName: upgrade.packName, itemName: upgrade.itemName, quantity: 1 }], errors };
  }

  const resolved = ciValue(map.weapons, name);
  const cyberName = (map.cyberwareWeapons || []).find(
    c => c === name || c === resolved || c.toLowerCase() === name.toLowerCase()
  );
  if (cyberName) {
    return { entries: [{ kind: "cyberware", packName: "core_cyberware", itemName: cyberName }], errors };
  }
  if (!resolved) {
    errors.push({ section: "weapons", message: `Unknown weapon: "${name}"` });
    return { entries: [], errors };
  }
  return { entries: [{ kind: "weapon", packName: "core_weapons", itemName: resolved, quality, damage }], errors };
}

// --- skills / role -----------------------------------------------------------
export function resolveSkillOrRole(name, level, map) {
  const roleName = ciValue(map.roleAbilities, name);
  if (roleName) {
    return { kind: "role", role: { packName: "core_roles", itemName: roleName, rank: level } };
  }
  const r = resolveSkillName(name, map);
  return { kind: "skill", skill: { name: r.name, base: level }, matched: r.matched };
}

function resolveSkillName(rawName, map) {
  const direct = ciValue(map.skills, rawName);
  if (direct !== undefined) return { name: direct, matched: true };

  // "Base (Specialization)" -> match base, keep specialization.
  const specMatch = rawName.match(/^(.+?)\s*(\([^)]*\))\s*$/);
  if (specMatch) {
    const base = specMatch[1].trim();
    const spec = specMatch[2].trim();
    const baseVal = ciValue(map.skills, base);
    if (baseVal !== undefined) return { name: `${baseVal} ${spec}`, matched: true };
  }
  return { name: rawName, matched: false };
}

// --- equipment ---------------------------------------------------------------
// Returns { entries:[{packName,itemName,quantity}], warnings:[] }.
// All entries carry a quantity; the equipment parser ignores it when routing
// cyberware (which dedupes by itemName only).
export function resolveEquipmentToken(token, map) {
  const warnings = [];
  const entries = [];
  const trimmed = token.trim();
  if (!trimmed) return { entries, warnings };

  // "Base xN w/ Accessory" — the "with" clause names a separate item
  // (e.g. "Cybereye x2 w/ Lowlight/Infrared/UV"). Resolve each part on its own.
  const withParts = trimmed.split(/\s+w\/\s+/i);
  if (withParts.length > 1) {
    for (const part of withParts) {
      const sub = resolveEquipmentToken(part, map);
      entries.push(...sub.entries);
      warnings.push(...sub.warnings);
    }
    return { entries: dedupeByItem(entries), warnings };
  }

  // An item whose canonical name itself contains parentheses (e.g.
  // "Implanted Linear Frame ∑ (Sigma)") must match as a whole before we try to
  // split the parenthetical into separate options.
  const { name: directName } = parseQuantity(trimmed);
  if (lookupDirect(directName, map)) {
    pushResolved(trimmed, entries, warnings, map, null);
    return { entries: dedupeByItem(entries), warnings };
  }

  // "A & B" — two separate accessories joined by an ampersand (e.g. a "w/"
  // clause like "Targeting Scope & Teleoptics"). Runs after the direct lookup
  // so a canonical name containing "&" (e.g. "Grafted Muscle & Bone Lace")
  // still matches as a whole.
  const ampParts = trimmed.split(/\s+&\s+/);
  if (ampParts.length > 1) {
    for (const part of ampParts) {
      const sub = resolveEquipmentToken(part, map);
      entries.push(...sub.entries);
      warnings.push(...sub.warnings);
    }
    return { entries: dedupeByItem(entries), warnings };
  }

  // "Base (opts) xN" — a quantity may trail the parenthetical. Pull it off so
  // the paren expansion can run, and apply it to the base item.
  let core = trimmed;
  let outerQty = null;
  const trailing = trimmed.match(/^(.*\))\s*x\s*(\d+)\s*$/i);
  if (trailing) { core = trailing[1].trim(); outerQty = Number(trailing[2]); }

  const paren = core.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (paren) {
    const base = paren[1].trim();
    const opts = splitTopLevel(paren[2], ",");
    pushResolved(base, entries, warnings, map, outerQty);
    for (const opt of opts) pushResolved(opt, entries, warnings, map, null);
    if (entries.length) return { entries: dedupeByItem(entries), warnings };
  }
  pushResolved(trimmed, entries, warnings, map, null);
  return { entries: dedupeByItem(entries), warnings };
}

// A parenthetical clarifier can resolve to the same canonical item as its base
// (e.g. "Flamethrower Ammo (Incendiary Shotgun Shells)" -> both map to
// "Shotgun Shell (Incendiary)"). Keep the first occurrence (the base, which
// carries the real quantity).
function dedupeByItem(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = `${e.packName}|${e.itemName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function pushResolved(token, entries, warnings, map, qtyOverride) {
  const { name, quantity: parsedQty } = parseQuantity(token);
  const quantity = qtyOverride ?? parsedQty;
  if (!name) return false;

  // Popup weapon in equipment context contributes only the cyberware mount;
  // the weapon itself appears in the weapons section.
  const popup = ciValue(map.popupWeapons, name);
  if (popup) { entries.push({ packName: "core_cyberware", itemName: popup.mount, quantity }); return true; }

  const ammo = ciValue(map.ammo, name);
  if (ammo) { entries.push({ ...ammo, quantity }); return true; }

  const equip = ciValue(map.equipment, name);
  if (equip) { entries.push({ ...equip, quantity }); return true; }

  const cyberWeapon = (map.cyberwareWeapons || []).find(
    c => c === name || c.toLowerCase() === name.toLowerCase()
  );
  if (cyberWeapon) { entries.push({ packName: "core_cyberware", itemName: cyberWeapon, quantity }); return true; }

  const weapon = ciValue(map.weapons, name);
  if (weapon) { entries.push({ packName: "core_cyberware", itemName: weapon, quantity }); return true; }

  warnings.push({ section: "equipment", message: `Unknown item: "${name}" — skipped` });
  return false;
}
