const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class CharacterCreatorApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "crw-character-creator",
    classes: ["crw-wizard"],
    tag: "div",
    window: {
      title: "Cyberpunk RED — Character Creator",
      icon: "fas fa-user-plus",
      resizable: true,
    },
    position: {
      width: 680,
      height: 600,
    },
  };

  static PARTS = {
    body: {
      template: "modules/cyberpunk-red-wizards/templates/creator.hbs",
    },
  };

  static #instance = null;

  static open() {
    if (!CharacterCreatorApp.#instance) {
      CharacterCreatorApp.#instance = new CharacterCreatorApp();
    }
    CharacterCreatorApp.#instance.render(true);
  }

  async _prepareContext(options) {
    return { placeholder: true };
  }

  async close(options = {}) {
    await super.close(options);
    CharacterCreatorApp.#instance = null;
  }
}
