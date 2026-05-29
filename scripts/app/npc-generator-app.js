import { loadAllTemplates, getCustomTemplates, saveCustomTemplates, clearNpcCache } from "../data/npc-loader.js";
import { getCategories, getEffectiveCategory, UNCATEGORIZED } from "../data/npc-categories.js";
import { createNpcFromTemplate } from "../npc/npc-factory.js";
import { STAT_KEYS, STAT_ABBRS } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const VISIBLE_SKILLS_COUNT = 8;

export default class NpcGeneratorApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "crw-npc-generator",
    classes: ["crw-npc-generator-window"],
    tag: "div",
    window: {
      title: "crw.npc.ui.title",
      icon: "fas fa-users",
      resizable: true,
    },
    position: {
      width: 800,
      height: 650,
    },
    actions: {
      createNpc: NpcGeneratorApp.#onCreateNpc,
      saveAsCustom: NpcGeneratorApp.#onSaveAsCustom,
      editTemplate: NpcGeneratorApp.#onEditTemplate,
      deleteTemplate: NpcGeneratorApp.#onDeleteTemplate,
      exportTemplates: NpcGeneratorApp.#onExportTemplates,
      importTemplates: NpcGeneratorApp.#onImportTemplates,
      newBlankTemplate: NpcGeneratorApp.#onNewBlankTemplate,
      importStatblock: NpcGeneratorApp.#onImportStatblock,
    },
  };

  static PARTS = {
    body: {
      template: "modules/cyberpunk-red-wizards/templates/npc-generator.hbs",
    },
  };

  static #instance = null;

  #templates = [];
  #uiState = { scrollTop: 0, searchFocused: false, searchSelStart: 0, searchSelEnd: 0 };
  #state = {
    selectedTemplateId: null,
    filter: { tier: "all", search: "" },
    showAllSkills: false,
    overrides: {
      name: null,
      actorType: "mook",
      stats: {},
      gear: {},
    },
  };

  static open() {
    if (!NpcGeneratorApp.#instance) {
      NpcGeneratorApp.#instance = new NpcGeneratorApp();
    }
    NpcGeneratorApp.#instance.render(true);
  }

  async #reloadTemplates() {
    clearNpcCache();
    this.#templates = await loadAllTemplates();
  }

  _getTemplateName(template) {
    if (template.name) return template.name;
    return game.i18n.localize(template.nameKey);
  }

  async _prepareContext(options) {
    const listEl = this.element?.querySelector(".crw-npc-template-list");
    const searchEl = this.element?.querySelector(".crw-npc-search");
    this.#uiState = {
      scrollTop: listEl?.scrollTop ?? 0,
      searchFocused: searchEl === document.activeElement,
      searchSelStart: searchEl?.selectionStart ?? 0,
      searchSelEnd: searchEl?.selectionEnd ?? 0,
    };

    if (this.#templates.length === 0) {
      this.#templates = await loadAllTemplates();
    }

    const { filter, selectedTemplateId, overrides, showAllSkills } = this.#state;

    const categories = getCategories();
    const searchLower = filter.search.toLowerCase();
    const filtered = this.#templates.filter(t => {
      if (filter.tier !== "all" && getEffectiveCategory(t, categories) !== filter.tier) return false;
      if (searchLower) {
        const name = this._getTemplateName(t).toLowerCase();
        if (!name.includes(searchLower)) return false;
      }
      return true;
    });

    const groupOrder = [...categories, UNCATEGORIZED];
    const mapTemplate = (t) => ({
      id: t.id,
      displayName: this._getTemplateName(t),
      hp: t.hp,
      sp: Math.max(t.armor.head?.sp ?? 0, t.armor.body?.sp ?? 0),
      topWeapon: t.weapons[0]?.itemName ?? "—",
      selected: t.id === selectedTemplateId,
      source: t.source ?? "built-in",
      isCustom: (t.source ?? "built-in") !== "built-in",
    });

    const tierGroups = [];
    for (const groupId of groupOrder) {
      const groupTemplates = filtered.filter(t => getEffectiveCategory(t, categories) === groupId);
      if (groupTemplates.length === 0) continue;
      tierGroups.push({
        id: groupId,
        label: groupId,
        count: groupTemplates.length,
        templates: groupTemplates.map(mapTemplate),
      });
    }

    const hasUncategorized = filtered.some(t => getEffectiveCategory(t, categories) === UNCATEGORIZED);
    const tiers = [...categories, ...(hasUncategorized ? [UNCATEGORIZED] : [])].map(name => ({
      id: name,
      label: name,
      selected: filter.tier === name,
    }));

    let selected = null;
    if (selectedTemplateId) {
      const template = this.#templates.find(t => t.id === selectedTemplateId);
      if (template) {
        const allSkills = [...template.skills].sort((a, b) => b.base - a.base);
        selected = {
          id: template.id,
          name: overrides.name ?? this._getTemplateName(template),
          source: template.source ?? "built-in",
          isCustom: (template.source ?? "built-in") !== "built-in",
          isMook: overrides.actorType === "mook",
          stats: STAT_KEYS.map(key => ({
            key,
            abbr: STAT_ABBRS[key],
            value: overrides.stats[key] ?? template.stats[key],
          })),
          hp: template.hp,
          seriousWound: template.seriousWound,
          deathSave: template.deathSave,
          armorHead: {
            ...template.armor.head,
            alternatives: template.armor.head?.alternatives?.map((alt, ai) => ({
              ...alt,
              selected: (overrides.gear["armor-head"] ?? 0) === ai,
            })),
          },
          armorBody: {
            ...template.armor.body,
            alternatives: template.armor.body?.alternatives?.map((alt, ai) => ({
              ...alt,
              selected: (overrides.gear["armor-body"] ?? 0) === ai,
            })),
          },
          weapons: template.weapons.map((w, i) => ({
            ...w,
            alternatives: w.alternatives?.map((alt, ai) => ({
              ...alt,
              selected: (overrides.gear[`weapon-${i}`] ?? 0) === ai,
            })),
          })),
          visibleSkills: showAllSkills ? allSkills : allSkills.slice(0, VISIBLE_SKILLS_COUNT),
          hasMoreSkills: allSkills.length > VISIBLE_SKILLS_COUNT,
          totalSkillCount: allSkills.length,
          showAllSkills,
          equipment: template.equipment.map((e, i) => ({
            ...e,
            alternatives: e.alternatives?.map((alt, ai) => ({
              ...alt,
              selected: (overrides.gear[`equip-${i}`] ?? 0) === ai,
            })),
          })),
          cyberware: template.cyberware.map((c, i) => ({
            ...c,
            alternatives: c.alternatives?.map((alt, ai) => ({
              ...alt,
              selected: (overrides.gear[`cyber-${i}`] ?? 0) === ai,
            })),
          })),
          role: template.role,
        };
      }
    }

    return { tierGroups, tiers, searchValue: filter.search, selected };
  }

  _onRender(context, options) {
    const el = this.element;

    el.querySelector(".crw-npc-tier-filter")?.addEventListener("change", (e) => {
      this.#state.filter.tier = e.target.value;
      this.render(true);
    });

    el.querySelector(".crw-npc-search")?.addEventListener("input", (e) => {
      this.#state.filter.search = e.target.value;
      this.render(true);
    });

    el.querySelectorAll(".crw-npc-template-item").forEach(item => {
      item.addEventListener("click", () => {
        this.#state.selectedTemplateId = item.dataset.templateId;
        this.#state.showAllSkills = false;
        this.#state.overrides = { name: null, actorType: "mook", stats: {}, gear: {} };
        this.render(true);
      });
    });

    el.querySelector(".crw-npc-name-input")?.addEventListener("input", (e) => {
      this.#state.overrides.name = e.target.value;
    });

    el.querySelectorAll("input[name='actorType']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        this.#state.overrides.actorType = e.target.value;
      });
    });

    el.querySelectorAll(".crw-npc-gear-select").forEach(select => {
      select.addEventListener("change", (e) => {
        this.#state.overrides.gear[e.target.dataset.gearKey] = Number(e.target.value);
        this.render(true);
      });
    });

    el.querySelector(".crw-npc-skills-toggle")?.addEventListener("click", () => {
      this.#state.showAllSkills = !this.#state.showAllSkills;
      this.render(true);
    });

    const listEl = el.querySelector(".crw-npc-template-list");
    if (listEl) listEl.scrollTop = this.#uiState.scrollTop;

    if (this.#uiState.searchFocused) {
      const searchEl = el.querySelector(".crw-npc-search");
      if (searchEl) {
        searchEl.focus();
        searchEl.setSelectionRange(this.#uiState.searchSelStart, this.#uiState.searchSelEnd);
      }
    }
  }

  static async #onCreateNpc() {
    const template = this.#templates.find(t => t.id === this.#state.selectedTemplateId);
    if (!template) return;

    const btn = this.element.querySelector("[data-action='createNpc']");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${game.i18n.localize("crw.npc.ui.creating")}`;
    }

    try {
      const actor = await createNpcFromTemplate(template, this.#state.overrides);
      await this.close();
      actor.sheet.render(true);
    } catch (err) {
      console.error("NPC creation failed:", err);
      ui.notifications.error("NPC creation failed. Check the console for details.");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-plus"></i> ${game.i18n.localize("crw.npc.ui.create")}`;
      }
    }
  }

  static async #onSaveAsCustom() {
    const template = this.#templates.find(t => t.id === this.#state.selectedTemplateId);
    if (!template) return;

    const clone = JSON.parse(JSON.stringify(template));
    clone.id = foundry.utils.randomID();
    clone.name = this._getTemplateName(template);
    clone.nameKey = null;
    clone.source = "custom";

    const { NpcTemplateEditorApp } = await import("./npc-template-editor-app.js");
    NpcTemplateEditorApp.open(clone, async (saved) => {
      const custom = getCustomTemplates();
      custom[saved.id] = saved;
      await saveCustomTemplates(custom);
      await this.#reloadTemplates();
      this.#state.selectedTemplateId = saved.id;
      this.render(true);
    });
  }

  static async #onEditTemplate() {
    const template = this.#templates.find(t => t.id === this.#state.selectedTemplateId);
    if (!template || (template.source ?? "built-in") === "built-in") return;

    const clone = JSON.parse(JSON.stringify(template));

    const { NpcTemplateEditorApp } = await import("./npc-template-editor-app.js");
    NpcTemplateEditorApp.open(clone, async (saved) => {
      const custom = getCustomTemplates();
      custom[saved.id] = saved;
      await saveCustomTemplates(custom);
      await this.#reloadTemplates();
      this.#state.selectedTemplateId = saved.id;
      this.render(true);
    });
  }

  static async #onDeleteTemplate() {
    const template = this.#templates.find(t => t.id === this.#state.selectedTemplateId);
    if (!template || (template.source ?? "built-in") === "built-in") return;

    const { DialogV2 } = foundry.applications.api;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("crw.npc.ui.deleteTemplate") },
      content: `<p>${game.i18n.localize("crw.npc.ui.deleteConfirm")}</p>`,
      rejectClose: false,
    });
    if (!confirmed) return;

    const custom = getCustomTemplates();
    delete custom[template.id];
    await saveCustomTemplates(custom);

    await this.#reloadTemplates();
    this.#state.selectedTemplateId = null;
    this.render(true);
  }

  static async #onExportTemplates() {
    const custom = getCustomTemplates();
    const arr = Object.values(custom);
    if (arr.length === 0) {
      ui.notifications.warn(game.i18n.localize("crw.npc.ui.noCustomToExport"));
      return;
    }
    const blob = new Blob([JSON.stringify(arr, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `crw-npc-templates-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async #onImportTemplates() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const arr = JSON.parse(text);
        if (!Array.isArray(arr)) throw new Error("Expected JSON array");

        const custom = getCustomTemplates();
        const existingNames = new Set(Object.values(custom).map(t => t.name));
        let imported = 0, skipped = 0, renamed = 0;

        for (const t of arr) {
          if (!t.id || !t.tier) continue;
          if (custom[t.id]) { skipped++; continue; }
          if (existingNames.has(t.name)) {
            let n = 2;
            while (existingNames.has(`${t.name} (${n})`)) n++;
            t.name = `${t.name} (${n})`;
            renamed++;
          }
          t.source = t.source || "custom";
          custom[t.id] = t;
          existingNames.add(t.name);
          imported++;
        }

        await saveCustomTemplates(custom);
        await this.#reloadTemplates();
        this.render(true);

        const msg = game.i18n.format("crw.npc.ui.importSummary", { imported, skipped, renamed });
        ui.notifications.info(msg);
      } catch (err) {
        console.error("Template import failed:", err);
        ui.notifications.error("Import failed. Check the console for details.");
      }
    });
    input.click();
  }

  static async #onNewBlankTemplate() {
    const { NpcTemplateEditorApp } = await import("./npc-template-editor-app.js");
    const blank = {
      id: foundry.utils.randomID(),
      name: "New Template",
      nameKey: null,
      tier: UNCATEGORIZED,
      source: "custom",
      stats: { int: 4, ref: 4, dex: 4, tech: 4, cool: 4, will: 4, luck: 0, move: 4, body: 4, emp: 4 },
      hp: 20,
      seriousWound: 10,
      deathSave: 4,
      armor: {
        head: { name: "", sp: 0, packName: "", itemName: "" },
        body: { name: "", sp: 0, packName: "", itemName: "" },
      },
      weapons: [],
      skills: [],
      equipment: [],
      cyberware: [],
      role: null,
    };
    NpcTemplateEditorApp.open(blank, async (saved) => {
      const custom = getCustomTemplates();
      custom[saved.id] = saved;
      await saveCustomTemplates(custom);
      await this.#reloadTemplates();
      this.#state.selectedTemplateId = saved.id;
      this.render(true);
    });
  }

  static async #onImportStatblock() {
    const { default: StatblockImportApp } = await import("./statblock-import-app.js");
    StatblockImportApp.open(async (saved) => {
      await this.#reloadTemplates();
      this.#state.selectedTemplateId = saved.id;
      this.render(true);
    });
  }

  async close(options = {}) {
    await super.close(options);
    NpcGeneratorApp.#instance = null;
  }
}
