import CharacterCreatorApp from "./app/creator-app.js";
import ImprovementApp from "./app/improvement-app.js";
import NpcGeneratorApp from "./app/npc-generator-app.js";
import { initSharedSocket } from "./socket.js";
import { initStoreSocket } from "./store/store-socket.js";
import { initCreatorSocket } from "./creator/creator-socket.js";
import { initImprovementPresence } from "./improvement/improvement-presence.js";
import StoreApp from "./app/store-app.js";
import StorePackConfig from "./app/store-pack-config.js";
import NpcCategoryConfig from "./app/npc-category-config.js";
import { migrateCustomTemplateCategories } from "./data/npc-categories.js";
import {
  MODULE_ID,
  DEFAULT_STAT_POINT_BUDGET,
  DEFAULT_SKILL_POINT_BUDGET,
} from "./constants.js";

Hooks.once("init", () => {
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("lt", (a, b) => a < b);
  Handlebars.registerHelper("gt", (a, b) => a > b);

  loadTemplates([
    "modules/cyberpunk-red-wizards/templates/partials/step-bar.hbs",
    "modules/cyberpunk-red-wizards/templates/partials/skill-row.hbs",
    "modules/cyberpunk-red-wizards/templates/partials/improvement-skill-row.hbs",
    "modules/cyberpunk-red-wizards/templates/partials/improvement-role-row.hbs",
    "modules/cyberpunk-red-wizards/templates/npc-editor/basics.hbs",
    "modules/cyberpunk-red-wizards/templates/npc-editor/combat.hbs",
    "modules/cyberpunk-red-wizards/templates/npc-editor/skills.hbs",
    "modules/cyberpunk-red-wizards/templates/npc-editor/extras.hbs",
  ]);

  game.settings.register(MODULE_ID, "defaultMethod", {
    name: `crw.settings.defaultMethod.name`,
    hint: `crw.settings.defaultMethod.hint`,
    scope: "client",
    config: true,
    type: String,
    choices: {
      streetrat: "crw.methods.streetrat",
      edgerunner: "crw.methods.edgerunner",
      complete: "crw.methods.complete",
    },
    default: "streetrat",
  });

  game.settings.register(MODULE_ID, "statPointBudget", {
    name: "crw.settings.statPointBudget.name",
    hint: "crw.settings.statPointBudget.hint",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_STAT_POINT_BUDGET,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "skillPointBudget", {
    name: "crw.settings.skillPointBudget.name",
    hint: "crw.settings.skillPointBudget.hint",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_SKILL_POINT_BUDGET,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "storeMarkup", {
    name: "crw.store.settings.costModifier",
    scope: "world",
    config: false,
    type: Number,
    default: 100,
  });

  game.settings.register(MODULE_ID, "storeAvailability", {
    name: "crw.store.settings.categories",
    scope: "world",
    config: false,
    type: Object,
    default: {
      categoryEnabled: {
        ammo: true, armor: true, clothing: true, cyberware: true,
        gear: true, program: true, itemUpgrade: true, vehicle: true, weapon: true,
      },
      blockedItems: [],
      priceMin: 0,
      priceMax: 0,
    },
  });

  game.settings.register(MODULE_ID, "storeExcludedPacks", {
    name: "crw.store.settings.excludedPacks",
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.registerMenu(MODULE_ID, "storeExcludedPacksMenu", {
    name: "crw.store.settings.excludedPacks",
    label: "crw.store.settings.excludedPacksLabel",
    hint: "crw.store.settings.excludedPacksHint",
    icon: "fas fa-boxes-stacked",
    type: StorePackConfig,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "customNpcTemplates", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, "npcCategories", {
    scope: "world",
    config: false,
    type: Array,
    default: ["Amateur", "Competent", "Elite", "Mini Boss", "Nightmare Boss"],
  });

  game.settings.register(MODULE_ID, "npcBuiltinCategoryOverrides", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.registerMenu(MODULE_ID, "npcCategoriesMenu", {
    name: "crw.npc.categories.settingName",
    label: "crw.npc.categories.settingLabel",
    hint: "crw.npc.categories.settingHint",
    icon: "fas fa-layer-group",
    type: NpcCategoryConfig,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "npcCategoryMigrationDone", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false,
  });
});

Hooks.once("ready", () => {
  const socket = initSharedSocket();
  initStoreSocket();
  initCreatorSocket();
  initImprovementPresence(socket);

  if (game.user.isGM && !game.settings.get(MODULE_ID, "npcCategoryMigrationDone")) {
    migrateCustomTemplateCategories()
      .then(() => game.settings.set(MODULE_ID, "npcCategoryMigrationDone", true))
      .catch(err => console.error("CRW | NPC category migration failed", err));
  }
});

Hooks.on("renderActorDirectory", (app, html) => {
  const headerActions = html[0]?.querySelector(".header-actions")
    ?? html.querySelector?.(".header-actions");
  if (!headerActions) return;

  const showCreator = game.user.isGM || !game.user.character;
  const showNpc = game.user.isGM;

  if (showCreator) {
    const creatorBtn = document.createElement("button");
    creatorBtn.type = "button";
    creatorBtn.classList.add("crw-sidebar-btn");
    creatorBtn.innerHTML = `<i class="fas fa-user-plus"></i> ${game.i18n.localize("crw.buttons.characterCreator")}`;
    creatorBtn.addEventListener("click", () => {
      CharacterCreatorApp.open();
    });
    headerActions.append(creatorBtn);
  }

  if (showNpc) {
    const npcBtn = document.createElement("button");
    npcBtn.type = "button";
    npcBtn.classList.add("crw-sidebar-btn");
    npcBtn.innerHTML = `<i class="fas fa-users"></i> ${game.i18n.localize("crw.buttons.npcTemplate")}`;
    npcBtn.addEventListener("click", () => {
      NpcGeneratorApp.open();
    });
    headerActions.append(npcBtn);
  }

  const footer = html[0]?.querySelector(".directory-footer")
    ?? html.querySelector?.(".directory-footer");
  const showImprovement = game.user.isGM || !!game.user.character;
  if (footer && showImprovement) {
    const ipBtn = document.createElement("button");
    ipBtn.type = "button";
    ipBtn.classList.add("crw-sidebar-btn");
    ipBtn.innerHTML = `<i class="fas fa-arrow-up-right-dots"></i> ${game.i18n.localize("crw.buttons.improvement")}`;
    ipBtn.classList.add("crw-improvement-btn");
    ipBtn.addEventListener("click", () => ImprovementApp.open());
    if (!footer.querySelector(".crw-improvement-btn")) footer.append(ipBtn);
  }
});

Hooks.on("renderItemDirectory", (app, html) => {
  const headerActions = html[0]?.querySelector(".header-actions")
    ?? html.querySelector?.(".header-actions");
  if (!headerActions) return;

  const storeBtn = document.createElement("button");
  storeBtn.type = "button";
  storeBtn.classList.add("crw-sidebar-btn");
  storeBtn.innerHTML = `<i class="fas fa-store"></i> ${game.i18n.localize("crw.store.buttons.store")}`;
  storeBtn.addEventListener("click", () => {
    StoreApp.open();
  });

  headerActions.append(storeBtn);
});
