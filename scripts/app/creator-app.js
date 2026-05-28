import StepStart from "../steps/step-start.js";
import StepLifepath from "../steps/step-lifepath.js";
import StepRelationships from "../steps/step-relationships.js";
import StepStats from "../steps/step-stats.js";
import StepDerived from "../steps/step-derived.js";
import StepSkills from "../steps/step-skills.js";
import StepGear from "../steps/step-gear.js";
import StepSummary from "../steps/step-summary.js";
import { requestCharacterCreation, NO_ACTIVE_GM } from "../creator/creator-socket.js";
import { MODULE_ID } from "../constants.js";
import { getStatPointBudget } from "../utils/creator-settings.js";

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
    actions: {
      back: CharacterCreatorApp.#onBack,
      next: CharacterCreatorApp.#onNext,
      createCharacter: CharacterCreatorApp.#onCreateCharacter,
    },
  };

  static PARTS = {
    body: {
      template: "modules/cyberpunk-red-wizards/templates/creator.hbs",
    },
  };

  static #instance = null;

  #steps = [];
  #currentStep = 0;
  state = {};

  static open() {
    if (!CharacterCreatorApp.#instance) {
      CharacterCreatorApp.#instance = new CharacterCreatorApp();
    }
    CharacterCreatorApp.#instance.render(true);
  }

  constructor(options = {}) {
    super(options);
    this.#steps = [];
    this.#currentStep = 0;
    this.state = {
      handle: "",
      method: game.settings.get(MODULE_ID, "defaultMethod"),
      role: null,
      lifepath: {},
      relationships: { friends: [], loveAffairs: [], enemies: [] },
      stats: { int: 2, ref: 2, dex: 2, tech: 2, cool: 2, will: 2, luck: 2, move: 2, body: 2, emp: 2 },
      skills: [],
      gear: {},
      cyberware: [],
      statPointBudgetOverride: game.user.isGM ? getStatPointBudget() : null,
    };
    this.registerSteps([
      new StepStart(),
      new StepLifepath(),
      new StepRelationships(),
      new StepStats(),
      new StepDerived(),
      new StepSkills(),
      new StepGear(),
      new StepSummary(),
    ]);
  }

  registerSteps(steps) {
    this.#steps = steps;
  }

  get currentStep() {
    return this.#currentStep;
  }

  get steps() {
    return this.#steps;
  }

  async _prepareContext(options) {
    const content = this.element?.querySelector(".crw-content");
    this._savedScrollTop = content?.scrollTop ?? null;

    const step = this.#steps[this.#currentStep];
    const stepContext = step ? await step.prepareContext(this.state) : {};
    let stepHtml = "";
    if (step) {
      const templatePath = step.getTemplate
        ? step.getTemplate(this.state)
        : step.template;
      stepHtml = await renderTemplate(templatePath, stepContext);
    }

    return {
      steps: this.#steps.map(s => ({ id: s.id, label: s.label })),
      currentStep: this.#currentStep,
      stepHtml,
      canAdvance: step ? step.validate(this.state) : false,
      isFinalStep: this.#currentStep === this.#steps.length - 1,
    };
  }

  _onRender(context, options) {
    const step = this.#steps[this.#currentStep];
    if (step) {
      step.activate(this.element, this.state, this);
    }
    if (this._savedScrollTop != null) {
      const content = this.element.querySelector(".crw-content");
      if (content) content.scrollTop = this._savedScrollTop;
      this._savedScrollTop = null;
    }
  }

  static async #onBack() {
    const step = this.#steps[this.#currentStep];
    if (step) step.serialize(this.element, this.state);
    if (this.#currentStep > 0) {
      this.#currentStep--;
      this.render(true);
    }
  }

  static async #onNext() {
    const step = this.#steps[this.#currentStep];
    if (step) step.serialize(this.element, this.state);
    if (step && !step.validate(this.state)) return;
    if (this.#currentStep < this.#steps.length - 1) {
      this.#currentStep++;
      this.render(true);
    }
  }

  static async #onCreateCharacter() {
    const step = this.#steps[this.#currentStep];
    if (!step || !step.validate(this.state)) return;

    const btn = this.element.querySelector("[data-action='createCharacter']");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${game.i18n.localize("crw.summary.creating")}`;
    }

    try {
      let actor;
      if (game.user.isGM) {
        actor = await step.createCharacter(this.state);
      } else {
        const uuid = await requestCharacterCreation(this.state);
        actor = await fromUuid(uuid);
      }

      await this.close();
      ui.sidebar.tabs.actors.render();

      if (actor) {
        actor.sheet.render(true);
        if (!game.user.isGM) {
          ui.notifications.info(game.i18n.format("crw.creator.assigned", { name: actor.name }));
        }
      }
    } catch (err) {
      console.error("Character creation failed:", err);
      if (err.message?.includes(NO_ACTIVE_GM)) {
        ui.notifications.warn(game.i18n.localize("crw.creator.gmOffline"));
      } else {
        ui.notifications.error("Character creation failed. Check the console for details.");
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize("crw.summary.create")}`;
      }
    }
  }

  async close(options = {}) {
    await super.close(options);
    CharacterCreatorApp.#instance = null;
  }
}
