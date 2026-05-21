import CharacterCreatorApp from "./app/creator-app.js";
import NpcGeneratorApp from "./app/npc-generator-app.js";
import { initSharedSocket } from "./socket.js";
import { initStoreSocket } from "./store/store-socket.js";
import { initCreatorSocket } from "./creator/creator-socket.js";
import StoreApp from "./app/store-app.js";
import StorePackConfig from "./app/store-pack-config.js";
const MODULE_ID = "cyberpunk-red-wizards";

Hooks.once("init", () => {
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("lt", (a, b) => a < b);
  Handlebars.registerHelper("gt", (a, b) => a > b);

  loadTemplates([
    "modules/cyberpunk-red-wizards/templates/partials/step-bar.hbs",
    "modules/cyberpunk-red-wizards/templates/partials/skill-row.hbs",
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
});

Hooks.once("ready", () => {
  initSharedSocket();
  initStoreSocket();
  initCreatorSocket();
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
