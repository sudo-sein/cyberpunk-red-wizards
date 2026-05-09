import CharacterCreatorApp from "./app/creator-app.js";

const MODULE_ID = "cyberpunk-red-wizards";

Hooks.once("init", () => {
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
    default: "complete",
  });
});

Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.can("ACTOR_CREATE")) return;

  const headerActions = html[0]?.querySelector(".header-actions")
    ?? html.querySelector?.(".header-actions");
  if (!headerActions) return;

  const creatorBtn = document.createElement("button");
  creatorBtn.type = "button";
  creatorBtn.classList.add("crw-sidebar-btn");
  creatorBtn.innerHTML = `<i class="fas fa-user-plus"></i> ${game.i18n.localize("crw.buttons.characterCreator")}`;
  creatorBtn.addEventListener("click", () => {
    CharacterCreatorApp.open();
  });

  const npcBtn = document.createElement("button");
  npcBtn.type = "button";
  npcBtn.classList.add("crw-sidebar-btn");
  npcBtn.innerHTML = `<i class="fas fa-users"></i> ${game.i18n.localize("crw.buttons.npcTemplate")}`;
  npcBtn.addEventListener("click", () => {
    ui.notifications.info(game.i18n.localize("crw.npcPlaceholder.content"));
  });

  headerActions.append(creatorBtn, npcBtn);
});
