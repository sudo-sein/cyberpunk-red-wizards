import StepStart from "../steps/step-start.js";
import StepStats from "../steps/step-stats.js";
import StepDerived from "../steps/step-derived.js";
import StepSkills from "../steps/step-skills.js";
import StepGear from "../steps/step-gear.js";
import StepSummary from "../steps/step-summary.js";

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
      method: game.settings.get("cyberpunk-red-wizards", "defaultMethod"),
      role: null,
      lifepath: {},
      stats: { int: 2, ref: 2, dex: 2, tech: 2, cool: 2, will: 2, luck: 2, move: 2, body: 2, emp: 2 },
      skills: [],
      gear: {},
      cyberware: [],
    };
    this.registerSteps([
      new StepStart(),
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
      const actor = await step.createCharacter(this.state);
      await this.close();
      actor.sheet.render(true);
    } catch (err) {
      console.error("Character creation failed:", err);
      ui.notifications.error("Character creation failed. Check the console for details.");
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
