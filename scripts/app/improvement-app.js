const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export default class ImprovementApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "crw-improvement",
    classes: ["crw-improvement-window-root"],
    tag: "div",
    window: {
      title: "crw.improvement.title",
      icon: "fas fa-arrow-up-right-dots",
      resizable: true,
    },
    position: { width: 820, height: 640 },
    actions: {
      incrementSkill: ImprovementApp.#onIncrementSkill,
      decrementSkill: ImprovementApp.#onDecrementSkill,
      incrementRole: ImprovementApp.#onIncrementRole,
      decrementRole: ImprovementApp.#onDecrementRole,
      openBuyRoleDialog: ImprovementApp.#onOpenBuyRoleDialog,
      resetCart: ImprovementApp.#onResetCart,
      cancel: ImprovementApp.#onCancel,
      apply: ImprovementApp.#onApply,
    },
  };

  static PARTS = {
    body: { template: "modules/cyberpunk-red-wizards/templates/improvement.hbs" },
  };

  /** @type {Map<string, ImprovementApp>} */
  static instances = new Map();

  /**
   * Resolve target actor and open (or focus) the wizard.
   * @param {Actor} [actor]
   */
  static async open(actor) {
    let target = actor ?? null;

    if (!target) {
      if (game.user.isGM) {
        target = await ImprovementApp.#promptForActor();
        if (!target) return;
      } else {
        target = game.user.character ?? null;
        if (!target) {
          ui.notifications.warn(game.i18n.localize("crw.improvement.errors.noCharacter"));
          return;
        }
      }
    }

    if (target.type !== "character") {
      ui.notifications.warn(game.i18n.localize("crw.improvement.errors.mookNotSupported"));
      return;
    }

    const existing = ImprovementApp.instances.get(target.id);
    if (existing) {
      existing.bringToTop();
      return;
    }

    const app = new ImprovementApp({ actor: target });
    ImprovementApp.instances.set(target.id, app);
    await app.render(true);
  }

  static async #promptForActor() {
    const choices = game.actors
      .filter((a) => a.type === "character" && a.isOwner)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (choices.length === 0) {
      ui.notifications.warn(game.i18n.localize("crw.improvement.errors.noCharacter"));
      return null;
    }
    if (choices.length === 1) return choices[0];

    const options = choices.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
    return await DialogV2.prompt({
      window: { title: game.i18n.localize("crw.improvement.actorPicker.label") },
      content: `<select name="actorId" style="width:100%">${options}</select>`,
      ok: {
        callback: (event, button) => {
          const id = button.form.elements.actorId.value;
          return game.actors.get(id) ?? null;
        },
      },
    }).catch(() => null);
  }

  // ── instance ──

  #actor;
  #cart = { skills: new Map(), roles: new Map(), newRoles: new Map() };
  #filterValue = "";
  #updateHookId = null;

  constructor({ actor, ...rest } = {}) {
    super(rest);
    this.#actor = actor;
  }

  get title() {
    return game.i18n.format("crw.improvement.title", { actorName: this.#actor?.name ?? "" });
  }

  async _prepareContext() {
    // Filled in Task 8.
    return { noActor: !this.#actor };
  }

  async close(options) {
    if (this.#updateHookId !== null) {
      Hooks.off("updateActor", this.#updateHookId);
      this.#updateHookId = null;
    }
    if (this.#actor) ImprovementApp.instances.delete(this.#actor.id);
    return super.close(options);
  }

  // ── action handlers (stubs, filled in later tasks) ──
  static #onIncrementSkill(event, target) { /* Task 9 */ }
  static #onDecrementSkill(event, target) { /* Task 9 */ }
  static #onIncrementRole(event, target) { /* Task 9 */ }
  static #onDecrementRole(event, target) { /* Task 9 */ }
  static #onOpenBuyRoleDialog(event, target) { /* Task 10 */ }
  static #onResetCart(event, target) { /* Task 9 */ }
  static #onCancel(event, target) { this.close(); }
  static #onApply(event, target) { /* Task 11 */ }
}
