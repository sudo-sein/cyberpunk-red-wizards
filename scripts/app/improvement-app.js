import * as ipCosts from "../improvement/ip-costs.js";

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
  #ipCosts = ipCosts;
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
    const actor = this.#actor;
    if (!actor) return { noActor: true };

    // Snapshot scroll position for restore in _onRender (ApplicationV2 pitfall).
    const body = this.element?.querySelector(".crw-improvement-body");
    this._savedScrollTop = body?.scrollTop ?? null;

    const currentIP = actor.system.improvementPoints?.value ?? 0;

    // Compute totalCost first (without per-row context) to drive canIncrement gating.
    const totalCost = this.#computeTotalCost();
    const projectedIP = currentIP - totalCost;

    const skillCategories = this.#buildSkillCategories(projectedIP);
    const roleRows = await this.#buildRoleRows(projectedIP);

    const canBuyNewRole = projectedIP >= 60 && !!game.packs.get("cyberpunk-red-core.core_roles");
    const buyNewRoleDisabledReason = !game.packs.get("cyberpunk-red-core.core_roles")
      ? game.i18n.localize("crw.improvement.errors.noRolesAvailable")
      : game.i18n.localize("crw.improvement.tooltips.insufficientIp");

    return {
      noActor: false,
      showActorPicker: game.user.isGM,
      actors: this.#actorChoices(),
      filterValue: this.#filterValue,
      skillCategories,
      roleRows,
      currentIP,
      projectedIP,
      projectedNegative: projectedIP < 0,
      totalCost,
      cartHasContent: this.#cartHasContent(),
      canBuyNewRole,
      buyNewRoleDisabledReason,
    };
  }

  _onRender(context, options) {
    const el = this.element;
    if (!el) return;

    if (this._savedScrollTop != null) {
      const body = el.querySelector(".crw-improvement-body");
      if (body) body.scrollTop = this._savedScrollTop;
      this._savedScrollTop = null;
    }

    el.querySelector(".crw-improvement-actor-select")?.addEventListener("change", (e) => {
      const newId = e.target.value;
      if (newId === this.#actor.id) return;
      const next = game.actors.get(newId);
      if (!next) return;
      // Close current and re-open for the new actor (preserves anti-double-open).
      this.close();
      ImprovementApp.open(next);
    });

    const filter = el.querySelector(".crw-improvement-filter");
    if (filter) {
      filter.addEventListener("input", (e) => {
        this.#filterValue = e.target.value;
        this.render(true);
      });
      // Restore caret position on re-render.
      if (this.#filterValue) {
        filter.focus();
        filter.selectionStart = filter.selectionEnd = filter.value.length;
      }
    }

    if (this.#updateHookId === null) {
      this.#updateHookId = Hooks.on("updateActor", (changed) => {
        if (changed.id !== this.#actor.id) return;
        this.#clampCartToCurrentActor();
        this.render(true);
      });
    }
  }

  // ── private helpers ──

  #cartHasContent() {
    return this.#cart.skills.size > 0
      || this.#cart.roles.size > 0
      || this.#cart.newRoles.size > 0;
  }

  #actorChoices() {
    if (!game.user.isGM) return [];
    return game.actors
      .filter((a) => a.type === "character" && a.isOwner)
      .map((a) => ({ id: a.id, name: a.name, selected: a.id === this.#actor.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  #computeTotalCost() {
    // Inlined cost math identical to commit-cart.js to keep preview/commit in sync.
    // Kept here (rather than imported) only because the cart is shaped differently
    // here (Map) — refactor later if a third caller appears.
    // eslint-disable-next-line no-restricted-syntax
    const { cumulativeSkillCost, cumulativeRoleCost, roleCost } =
      /** @type {typeof import("../improvement/ip-costs.js")} */ (this.#ipCosts);
    let total = 0;
    for (const [id, delta] of this.#cart.skills) {
      const item = this.#actor.items.get(id);
      if (!item || delta <= 0) continue;
      total += cumulativeSkillCost(item.system.level ?? 0, delta, item.system.difficulty);
    }
    for (const [id, delta] of this.#cart.roles) {
      const item = this.#actor.items.get(id);
      if (!item || delta <= 0) continue;
      total += cumulativeRoleCost(item.system.rank ?? 0, delta);
    }
    for (const [, entry] of this.#cart.newRoles) {
      if (entry.plannedRank <= 0) continue;
      total += cumulativeRoleCost(0, entry.plannedRank);
    }
    return total;
  }

  #clampCartToCurrentActor() {
    let droppedMissing = false;

    for (const [id] of this.#cart.skills) {
      if (!this.#actor.items.get(id)) { this.#cart.skills.delete(id); droppedMissing = true; }
    }
    for (const [id] of this.#cart.roles) {
      if (!this.#actor.items.get(id)) { this.#cart.roles.delete(id); droppedMissing = true; }
    }

    // Trim cart if projected IP is now negative.
    const currentIP = this.#actor.system.improvementPoints?.value ?? 0;
    while (this.#computeTotalCost() > currentIP) {
      // Reduce the most expensive single increment first.
      const candidates = [];
      for (const [id, delta] of this.#cart.skills) {
        if (delta > 0) {
          const item = this.#actor.items.get(id);
          if (!item) continue;
          const lastCost = this.#ipCosts.skillCost((item.system.level ?? 0) + delta, item.system.difficulty);
          candidates.push({ kind: "skill", id, lastCost });
        }
      }
      for (const [id, delta] of this.#cart.roles) {
        if (delta > 0) {
          const item = this.#actor.items.get(id);
          if (!item) continue;
          const lastCost = this.#ipCosts.roleCost((item.system.rank ?? 0) + delta);
          candidates.push({ kind: "role", id, lastCost });
        }
      }
      for (const [syntheticId, entry] of this.#cart.newRoles) {
        if (entry.plannedRank > 0) {
          const lastCost = this.#ipCosts.roleCost(entry.plannedRank);
          candidates.push({ kind: "newRole", id: syntheticId, lastCost });
        }
      }
      if (candidates.length === 0) break;
      candidates.sort((a, b) => b.lastCost - a.lastCost);
      const victim = candidates[0];
      if (victim.kind === "skill") {
        const next = this.#cart.skills.get(victim.id) - 1;
        if (next <= 0) this.#cart.skills.delete(victim.id);
        else this.#cart.skills.set(victim.id, next);
      } else if (victim.kind === "role") {
        const next = this.#cart.roles.get(victim.id) - 1;
        if (next <= 0) this.#cart.roles.delete(victim.id);
        else this.#cart.roles.set(victim.id, next);
      } else {
        const entry = this.#cart.newRoles.get(victim.id);
        entry.plannedRank -= 1;
        if (entry.plannedRank <= 0) this.#cart.newRoles.delete(victim.id);
      }
    }

    // Trim-to-fit is intentionally silent; only material drops (missing items) toast.
    if (droppedMissing) {
      ui.notifications.warn(game.i18n.localize("crw.improvement.errors.cartStale"));
    }
  }

  #buildSkillCategories(projectedIP) {
    const categoryOrder = [
      "awarenessSkills", "bodySkills", "controlSkills", "combatSkills",
      "educationSkills", "fightingSkills", "performanceSkills",
      "socialSkills", "techniqueSkills",
    ];
    const grouped = new Map(categoryOrder.map((k) => [k, []]));
    const filter = this.#filterValue.toLowerCase();
    const { cumulativeSkillCost, skillCost } = this.#ipCosts;

    for (const item of this.#actor.items) {
      if (item.type !== "skill") continue;
      if (filter && !item.name.toLowerCase().includes(filter)) continue;

      const level = item.system.level ?? 0;
      const difficulty = item.system.difficulty;
      const delta = this.#cart.skills.get(item.id) ?? 0;
      const nextCost = level + delta < 10 ? skillCost(level + delta + 1, difficulty) : 0;
      const plannedTotalCost = cumulativeSkillCost(level, delta, difficulty);
      const remainingIfIncrement = projectedIP - nextCost;
      const canIncrement = level + delta < 10 && remainingIfIncrement >= 0;
      const canDecrement = delta > 0;
      const disabledReason = level + delta >= 10
        ? game.i18n.localize("crw.improvement.tooltips.capReached")
        : game.i18n.localize("crw.improvement.tooltips.insufficientIp");

      const row = {
        id: item.id,
        name: item.name,
        level,
        delta,
        isDifficult: difficulty === "difficult",
        nextCost,
        plannedTotalCost,
        canIncrement,
        canDecrement,
        disabledReason,
      };
      const bucket = grouped.get(item.system.category);
      if (bucket) bucket.push(row);
      else grouped.set(item.system.category ?? "_other", [...(grouped.get("_other") ?? []), row]);
    }

    for (const list of grouped.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    return Array.from(grouped.entries())
      .filter(([, rows]) => rows.length > 0)
      .map(([key, rows]) => ({
        key,
        label: `CPR.global.skills.category.${key}`,
        rows,
        plannedCount: rows.filter((r) => r.delta > 0).length,
        open: rows.some((r) => r.delta > 0) || !!filter,
      }));
  }

  async #buildRoleRows(projectedIP) {
    const { roleCost, cumulativeRoleCost } = this.#ipCosts;
    const rows = [];

    for (const item of this.#actor.items) {
      if (item.type !== "role") continue;
      const rank = item.system.rank ?? 0;
      const delta = this.#cart.roles.get(item.id) ?? 0;
      const plannedRank = rank + delta;
      const nextCost = plannedRank < 10 ? roleCost(plannedRank + 1) : 0;
      const plannedTotalCost = cumulativeRoleCost(rank, delta);
      const canIncrement = plannedRank < 10 && projectedIP - nextCost >= 0;
      const canDecrement = delta > 0;
      rows.push({
        id: item.id,
        name: item.name,
        rank,
        delta,
        plannedRank,
        isNew: false,
        nextCost,
        plannedTotalCost,
        canIncrement,
        canDecrement,
        disabledReason: plannedRank >= 10
          ? game.i18n.localize("crw.improvement.tooltips.capReached")
          : game.i18n.localize("crw.improvement.tooltips.insufficientIp"),
      });
    }

    for (const [syntheticId, entry] of this.#cart.newRoles) {
      const plannedRank = entry.plannedRank;
      const nextCost = plannedRank < 10 ? roleCost(plannedRank + 1) : 0;
      const plannedTotalCost = cumulativeRoleCost(0, plannedRank);
      const canIncrement = plannedRank < 10 && projectedIP - nextCost >= 0;
      const canDecrement = plannedRank > 0; // decrementing from 1 removes entirely
      rows.push({
        id: syntheticId,
        name: entry.name,
        rank: 0,
        delta: plannedRank,
        plannedRank,
        isNew: true,
        nextCost,
        plannedTotalCost,
        canIncrement,
        canDecrement,
        disabledReason: game.i18n.localize("crw.improvement.tooltips.capReached"),
      });
    }

    return rows;
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
  static #onIncrementSkill(event, target) {
    const id = target.dataset.id;
    const current = this.#cart.skills.get(id) ?? 0;
    this.#cart.skills.set(id, current + 1);
    this.render(true);
  }

  static #onDecrementSkill(event, target) {
    const id = target.dataset.id;
    const current = this.#cart.skills.get(id) ?? 0;
    const next = Math.max(0, current - 1);
    if (next === 0) this.#cart.skills.delete(id);
    else this.#cart.skills.set(id, next);
    this.render(true);
  }

  static #onIncrementRole(event, target) {
    const id = target.dataset.id;
    if (id.startsWith("new:")) {
      const entry = this.#cart.newRoles.get(id);
      if (!entry) return;
      entry.plannedRank += 1;
    } else {
      const current = this.#cart.roles.get(id) ?? 0;
      this.#cart.roles.set(id, current + 1);
    }
    this.render(true);
  }

  static #onDecrementRole(event, target) {
    const id = target.dataset.id;
    if (id.startsWith("new:")) {
      const entry = this.#cart.newRoles.get(id);
      if (!entry) return;
      entry.plannedRank -= 1;
      if (entry.plannedRank <= 0) this.#cart.newRoles.delete(id);
    } else {
      const current = this.#cart.roles.get(id) ?? 0;
      const next = Math.max(0, current - 1);
      if (next === 0) this.#cart.roles.delete(id);
      else this.#cart.roles.set(id, next);
    }
    this.render(true);
  }

  static #onOpenBuyRoleDialog(event, target) { /* Task 10 */ }

  static #onResetCart() {
    this.#cart.skills.clear();
    this.#cart.roles.clear();
    this.#cart.newRoles.clear();
    this.render(true);
  }

  static #onCancel(event, target) { this.close(); }
  static #onApply(event, target) { /* Task 11 */ }
}
