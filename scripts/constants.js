// scripts/constants.js
// Single source of truth for module-wide constants. No imports — safe to load
// in the node:test harness without Foundry globals.

export const MODULE_ID = "cyberpunk-red-wizards";

// Canonical CPR stat order. Used for iteration and for mapping stat-template
// columns (index position is significant — do not reorder).
export const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];

export const STAT_ABBRS = {
  int: "INT", ref: "REF", dex: "DEX", tech: "TECH", cool: "COOL",
  will: "WILL", luck: "LUCK", move: "MOVE", body: "BODY", emp: "EMP",
};
