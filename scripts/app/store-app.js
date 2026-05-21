import { loadStoreItems, categorizeItems, groupBySource } from "../data/store-loader.js";
import { purchaseItem, lootItem, calculateFinalPrice } from "../store/store-purchase.js";
import { broadcastStoreState } from "../store/store-socket.js";
import { MODULE_ID } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const CATEGORY_TABS = [
  { type: "ammo", label: "crw.store.categories.ammo" },
  { type: "armor", label: "crw.store.categories.armor" },
  { type: "clothing", label: "crw.store.categories.clothing" },
  { type: "cyberware", label: "crw.store.categories.cyberware" },
  { type: "gear", label: "crw.store.categories.gear" },
  { type: "program", label: "crw.store.categories.program" },
  { type: "itemUpgrade", label: "crw.store.categories.itemUpgrade" },
  { type: "vehicle", label: "crw.store.categories.vehicle" },
  { type: "weapon", label: "crw.store.categories.weapon" },
];

export default class StoreApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "crw-store",
    classes: ["crw-store-window"],
    tag: "div",
    window: {
      title: "crw.store.title",
      icon: "fas fa-store",
      resizable: true,
    },
    position: {
      width: 750,
      height: 650,
    },
    actions: {
      buyItem: StoreApp.#onBuyItem,
      lootItem: StoreApp.#onLootItem,
      adjustMarkup: StoreApp.#onAdjustMarkup,
      setMarkup: StoreApp.#onSetMarkup,
      resetPriceRange: StoreApp.#onResetPriceRange,
      restoreItem: StoreApp.#onRestoreItem,
      restoreAllItems: StoreApp.#onRestoreAllItems,
      hideItem: StoreApp.#onHideItem,
      clearSearch: StoreApp.#onClearSearch,
    },
  };

  static PARTS = {
    body: {
      template: "modules/cyberpunk-red-wizards/templates/store.hbs",
    },
  };

  static #instance = null;

  #allItems = null;
  #state = {
    activeTab: "weapon",
    searchValue: "",
    selectedActorId: null,
  };

  static open() {
    if (!StoreApp.#instance) {
      StoreApp.#instance = new StoreApp();
    }
    StoreApp.#instance.render(true);
  }

  static refresh() {
    if (StoreApp.#instance) StoreApp.#instance.render(true);
  }

  #getSelectedActor() {
    if (this.#state.selectedActorId) {
      const actor = game.actors.get(this.#state.selectedActorId);
      if (actor) return actor;
    }
    if (game.user.character) {
      this.#state.selectedActorId = game.user.character.id;
      return game.user.character;
    }
    const choices = this.#getActorChoices();
    if (choices.length > 0) {
      this.#state.selectedActorId = choices[0].id;
      return game.actors.get(choices[0].id);
    }
    return null;
  }

  #getActorChoices() {
    const actors = game.user.isGM
      ? game.actors.filter(a => a.type === "character")
      : game.actors.filter(a => a.isOwner && a.type === "character");
    return actors.map(a => ({
      id: a.id,
      name: a.name,
      selected: a.id === this.#state.selectedActorId,
    }));
  }

  async _prepareContext(options) {
    const body = this.element?.querySelector(".crw-store-body");
    this._savedScrollTop = body?.scrollTop ?? null;

    if (!this.#allItems) {
      this.#allItems = await loadStoreItems();
    }

    const actor = this.#getSelectedActor();
    const markup = game.settings.get(MODULE_ID, "storeMarkup");
    const availability = game.settings.get(MODULE_ID, "storeAvailability");
    const { categoryEnabled, blockedItems, priceMin, priceMax } = availability;
    const blockedSet = new Set(blockedItems);
    const balance = actor?.system.wealth.value ?? 0;
    const isGM = game.user.isGM;
    const settingsActive = this.#state.activeTab === "settings";

    const tabs = CATEGORY_TABS.map(t => ({
      ...t,
      active: this.#state.activeTab === t.type,
      visible: categoryEnabled[t.type] !== false,
    }));

    let itemGroups = [];
    if (actor && !settingsActive) {
      const categorized = categorizeItems(this.#allItems);
      let tabItems = categorized[this.#state.activeTab] ?? [];

      tabItems = tabItems.filter(item => {
        if (blockedSet.has(item.uuid)) return false;
        if (priceMin > 0 && item.price < priceMin) return false;
        if (priceMax > 0 && item.price > priceMax) return false;
        return true;
      });

      if (this.#state.searchValue) {
        const search = this.#state.searchValue.toLowerCase();
        tabItems = tabItems.filter(item => item.name.toLowerCase().includes(search));
      }

      itemGroups = groupBySource(tabItems).map(group => ({
        ...group,
        items: group.items.map(item => {
          const finalPrice = calculateFinalPrice(item.price, markup);
          return {
            ...item,
            finalPrice: finalPrice.toLocaleString(),
            unaffordable: finalPrice > balance && finalPrice > 0,
          };
        }),
      }));
    }

    const categoryToggles = CATEGORY_TABS.map(t => ({
      type: t.type,
      label: t.label,
      enabled: categoryEnabled[t.type] !== false,
    }));

    let hiddenItems = [];
    if (isGM && blockedItems.length > 0) {
      hiddenItems = blockedItems
        .map(uuid => this.#allItems.find(i => i.uuid === uuid))
        .filter(Boolean)
        .map(item => ({
          uuid: item.uuid,
          name: item.name,
          typeLabel: game.i18n.localize(`crw.store.categories.${item.type}`),
        }));
    }

    return {
      actors: this.#getActorChoices(),
      selectedActor: !!actor,
      noActor: !actor,
      balance: balance.toLocaleString(),
      tabs,
      settingsActive,
      isGM,
      markup,
      priceMin,
      priceMax,
      categoryToggles,
      hiddenItems,
      itemGroups,
      searchValue: this.#state.searchValue,
    };
  }

  _onRender(context, options) {
    const el = this.element;

    if (this._savedScrollTop != null) {
      const body = el.querySelector(".crw-store-body");
      if (body) body.scrollTop = this._savedScrollTop;
      this._savedScrollTop = null;
    }

    el.querySelector(".crw-store-actor-select")?.addEventListener("change", (e) => {
      this.#state.selectedActorId = e.target.value;
      this.render(true);
    });

    el.querySelectorAll(".crw-store-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        this.#state.activeTab = tab.dataset.tab;
        this.#state.searchValue = "";
        this.render(true);
      });
    });

    const searchInput = el.querySelector(".crw-store-search-input");
    if (searchInput && this.#state.searchValue) {
      searchInput.focus();
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
    }

    searchInput?.addEventListener("input", (e) => {
      this.#state.searchValue = e.target.value;
      this.render(true);
    });

    el.querySelectorAll("[data-category]").forEach(checkbox => {
      checkbox.addEventListener("change", () =>
        this.#updateAvailability(a => { a.categoryEnabled[checkbox.dataset.category] = checkbox.checked; })
      );
    });

    el.querySelector(".crw-store-price-min")?.addEventListener("change", (e) =>
      this.#updateAvailability(a => { a.priceMin = Math.max(0, Number(e.target.value) || 0); })
    );

    el.querySelector(".crw-store-price-max")?.addEventListener("change", (e) =>
      this.#updateAvailability(a => { a.priceMax = Math.max(0, Number(e.target.value) || 0); })
    );

  }

  #findItem(uuid) {
    return this.#allItems?.find(i => i.uuid === uuid) ?? null;
  }

  async #updateAvailability(mutator) {
    const availability = foundry.utils.deepClone(
      game.settings.get(MODULE_ID, "storeAvailability")
    );
    mutator(availability);
    await game.settings.set(MODULE_ID, "storeAvailability", availability);
    broadcastStoreState();
    this.render(true);
  }

  static async #onBuyItem(event, target) {
    const uuid = target.dataset.uuid;
    const item = this.#findItem(uuid);
    const actor = this.#getSelectedActor();
    if (!item || !actor) return;

    const markup = game.settings.get(MODULE_ID, "storeMarkup");
    const bought = await purchaseItem(actor, item, markup);
    if (bought) this.render(true);
  }

  static async #onLootItem(event, target) {
    const uuid = target.dataset.uuid;
    const item = this.#findItem(uuid);
    const actor = this.#getSelectedActor();
    if (!item || !actor) return;

    await lootItem(actor, item);
  }

  static async #onAdjustMarkup(event, target) {
    const delta = Number(target.dataset.delta);
    let markup = game.settings.get(MODULE_ID, "storeMarkup");
    markup = Math.max(0, Math.min(500, markup + delta));
    await game.settings.set(MODULE_ID, "storeMarkup", markup);
    broadcastStoreState();
    this.render(true);
  }

  static async #onSetMarkup(event, target) {
    const value = Number(target.dataset.value);
    await game.settings.set(MODULE_ID, "storeMarkup", value);
    broadcastStoreState();
    this.render(true);
  }

  static async #onResetPriceRange() {
    await this.#updateAvailability(a => { a.priceMin = 0; a.priceMax = 0; });
  }

  static async #onHideItem(event, target) {
    const uuid = target.dataset.uuid;
    await this.#updateAvailability(a => { if (!a.blockedItems.includes(uuid)) a.blockedItems.push(uuid); });
  }

  static async #onRestoreItem(event, target) {
    const uuid = target.dataset.uuid;
    await this.#updateAvailability(a => { a.blockedItems = a.blockedItems.filter(u => u !== uuid); });
  }

  static async #onRestoreAllItems() {
    await this.#updateAvailability(a => { a.blockedItems = []; });
  }

  static #onClearSearch() {
    this.#state.searchValue = "";
    this.render(true);
  }

  async close(options = {}) {
    await super.close(options);
    StoreApp.#instance = null;
    this.#allItems = null;
  }
}
