import { parseStatblock } from "../import/statblock-parser.js";
import { createNpcFromTemplate } from "../npc/npc-factory.js";
import { getCustomTemplates, saveCustomTemplates } from "../data/npc-loader.js";
import { getCategories, UNCATEGORIZED } from "../data/npc-categories.js";
import { CORE_IMPORT_SECTIONS } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class StatblockImportApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "crw-statblock-import",
    classes: ["crw-import-window"],
    tag: "div",
    window: {
      title: "crw.import.title",
      icon: "fas fa-file-import",
      resizable: true,
    },
    position: {
      width: 700,
      height: 650,
    },
    actions: {
      parse: StatblockImportApp.#onParse,
      saveTemplate: StatblockImportApp.#onSaveTemplate,
      createNpc: StatblockImportApp.#onCreateNpc,
    },
  };

  static PARTS = {
    body: {
      template: "modules/cyberpunk-red-wizards/templates/statblock-import.hbs",
    },
  };

  static #instance = null;

  #state = {
    language: "en",
    inputText: "",
    result: null,
  };

  #onSavedCallback = null;

  static open(onSaved = null) {
    if (!StatblockImportApp.#instance) {
      StatblockImportApp.#instance = new StatblockImportApp();
    }
    StatblockImportApp.#instance.#onSavedCallback = onSaved;
    StatblockImportApp.#instance.render(true);
  }

  async _prepareContext() {
    const { language, inputText, result } = this.#state;
    const diag = result?.diagnostics ?? null;
    const missing = diag ? CORE_IMPORT_SECTIONS.filter(k => !diag.sections[k]) : [];
    const diagnosticsSummary = diag ? {
      found: diag.score.found,
      total: diag.score.total,
      missing,
      missingLabel: missing.join(", "),
    } : null;
    return {
      language,
      inputText,
      hasResult: !!result,
      template: result?.template ?? null,
      errors: result?.errors ?? [],
      warnings: result?.warnings ?? [],
      hasErrors: (result?.errors?.length ?? 0) > 0,
      hasWarnings: (result?.warnings?.length ?? 0) > 0,
      stats: result?.template ? Object.entries(result.template.stats).map(([key, value]) => ({ abbr: key.toUpperCase(), value })) : [],
      categories: [...getCategories(), UNCATEGORIZED].map(name => ({
        name,
        selected: name === (result?.template?.tier ?? UNCATEGORIZED),
      })),
      diagnosticsSummary,
    };
  }

  _onRender() {
    const el = this.element;

    el.querySelector("[name='language']")?.addEventListener("change", (e) => {
      this.#state.language = e.target.value;
    });

    el.querySelector("[name='statblockText']")?.addEventListener("input", (e) => {
      this.#state.inputText = e.target.value;
    });

    el.querySelector("[name='importCategory']")?.addEventListener("change", (e) => {
      if (this.#state.result?.template) this.#state.result.template.tier = e.target.value;
    });
  }

  static async #onParse() {
    if (!this.#state.inputText.trim()) return;
    this.#state.result = await parseStatblock(this.#state.inputText, this.#state.language);
    this.render(true);
    if (this.#state.result.errors.length === 0) {
      ui.notifications.info(game.i18n.localize("crw.import.parseSuccess"));
    }
  }

  static async #onSaveTemplate() {
    if (!this.#state.result?.template) return;

    const { DialogV2 } = foundry.applications.api;
    const defaultName = this.#state.result.template.name;
    const name = await DialogV2.prompt({
      window: { title: game.i18n.localize("crw.import.templateName") },
      content: `<input type="text" name="crwImportName" style="width:100%;margin-bottom:8px;" autofocus />`,
      render: (event, dialogEl) => {
        const input = dialogEl.querySelector("input[name='crwImportName']");
        if (input) input.value = defaultName;
      },
      ok: {
        label: game.i18n.localize("crw.npc.editor.save"),
        callback: (event, button) => button.form.elements.crwImportName.value,
      },
      rejectClose: false,
    });
    if (!name) return;

    const t = JSON.parse(JSON.stringify(this.#state.result.template));
    t.name = name;
    t.source = "imported";

    const custom = getCustomTemplates();
    custom[t.id] = t;
    await saveCustomTemplates(custom);
    ui.notifications.info(`Template "${name}" saved.`);
    if (this.#onSavedCallback) this.#onSavedCallback(t);
  }

  static async #onCreateNpc() {
    if (!this.#state.result?.template) return;

    const btn = this.element.querySelector("[data-action='createNpc']");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${game.i18n.localize("crw.npc.ui.creating")}`;
    }

    try {
      const actor = await createNpcFromTemplate(this.#state.result.template, {});
      await this.close();
      actor.sheet.render(true);
    } catch (err) {
      console.error("NPC creation from import failed:", err);
      ui.notifications.error("NPC creation failed. Check the console for details.");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-plus"></i> ${game.i18n.localize("crw.import.createNpc")}`;
      }
    }
  }

  async close(options = {}) {
    await super.close(options);
    StatblockImportApp.#instance = null;
  }
}
