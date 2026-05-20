import { parseStatblock } from "../import/statblock-parser.js";
import { createNpcFromTemplate } from "../npc/npc-factory.js";
import { getCustomTemplates, saveCustomTemplates } from "../data/npc-loader.js";

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

    const name = await new Promise(resolve => {
      new Dialog({
        title: game.i18n.localize("crw.import.templateName"),
        content: `<input type="text" id="crw-import-name" value="${this.#state.result.template.name}" style="width:100%;margin-bottom:8px;" />`,
        buttons: {
          ok: { label: game.i18n.localize("crw.npc.editor.save"), callback: (html) => resolve(html.find("#crw-import-name").val()) },
          cancel: { label: game.i18n.localize("crw.npc.editor.cancel"), callback: () => resolve(null) },
        },
        default: "ok",
      }).render(true);
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
