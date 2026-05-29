import { test } from "node:test";
import { strictEqual } from "node:assert/strict";
import { categoryLabelKey } from "../../scripts/improvement/skill-categories.js";

test("categoryLabelKey uses CONFIG.CPR.skillCategories mapping when available", () => {
  globalThis.CONFIG = {
    CPR: {
      skillCategories: {
        awarenessSkills: "CPR.global.skillCategories.awarenessSkills",
      },
    },
  };

  strictEqual(categoryLabelKey("awarenessSkills"), "CPR.global.skillCategories.awarenessSkills");
});

test("categoryLabelKey falls back to rangedWeaponSkills localization key", () => {
  globalThis.CONFIG = { CPR: { skillCategories: {} } };
  strictEqual(categoryLabelKey("rangedweaponSkills"), "CPR.global.skillCategories.rangedWeaponSkills");
});

test("categoryLabelKey falls back to generic skillCategories key", () => {
  globalThis.CONFIG = { CPR: { skillCategories: {} } };
  strictEqual(categoryLabelKey("socialSkills"), "CPR.global.skillCategories.socialSkills");
});
