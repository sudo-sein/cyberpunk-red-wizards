// scripts/constants.js
// Single source of truth for module-wide constants. No imports — safe to load
// in the node:test harness without Foundry globals.

export const MODULE_ID = "cyberpunk-red-wizards";
export const DEFAULT_STAT_POINT_BUDGET = 62;
export const DEFAULT_SKILL_POINT_BUDGET = 86;

// Canonical CPR stat order. Used for iteration and for mapping stat-template
// columns (index position is significant — do not reorder).
export const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];

export const STAT_ABBRS = {
  int: "INT", ref: "REF", dex: "DEX", tech: "TECH", cool: "COOL",
  will: "WILL", luck: "LUCK", move: "MOVE", body: "BODY", emp: "EMP",
};

// Core statblock-import sections that count toward parse confidence. Gear
// (equipment/cyberware) is intentionally excluded — it is optional and never
// scored or warned. Shared by the parser's diagnostics and the import UI so the
// scored set stays in lockstep.
export const CORE_IMPORT_SECTIONS = ["stats", "vitals", "armor", "weapons", "skills"];
