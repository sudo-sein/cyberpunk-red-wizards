import {
  getCategories, addCategory, removeCategory, reorderCategory, renameCategory,
} from "../data/npc-categories.js";

export default class NpcCategoryConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "crw-npc-category-config",
      title: game.i18n.localize("crw.npc.categories.settingName"),
      template: "modules/cyberpunk-red-wizards/templates/npc-category-config.hbs",
      width: 420,
      height: "auto",
      closeOnSubmit: true,
    });
  }

  getData() {
    const categories = getCategories();
    return {
      categories: categories.map((name, i) => ({
        name,
        isFirst: i === 0,
        isLast: i === categories.length - 1,
      })),
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;

    el.querySelectorAll("[data-action='moveUp'], [data-action='moveDown']").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const row = e.currentTarget.closest(".crw-category-row");
        const dir = e.currentTarget.dataset.action === "moveUp" ? "up" : "down";
        await this.#applyPendingRenames();
        // Read the (possibly just-renamed) current name from the row's input.
        const name = row.querySelector("[name='rename']").value.trim();
        await reorderCategory(name, dir);
        this.render(true);
      });
    });

    el.querySelectorAll("[data-action='remove']").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const row = e.currentTarget.closest(".crw-category-row");
        await this.#applyPendingRenames();
        const name = row.querySelector("[name='rename']").value.trim();
        await removeCategory(name);
        this.render(true);
      });
    });

    el.querySelector("[data-action='add']")?.addEventListener("click", async () => {
      const input = el.querySelector("[name='newCategory']");
      await this.#applyPendingRenames();
      try {
        await addCategory(input.value);
        this.render(true);
      } catch (err) {
        ui.notifications.warn(err.message);
      }
    });
  }

  // Commit any rename inputs whose value differs from the category they
  // represent (data-name holds the original). Runs before every action and on
  // submit, so there is exactly one rename mechanism and no mid-gesture
  // re-render that could swallow a click.
  async #applyPendingRenames() {
    const rows = (this.element[0] ?? this.element).querySelectorAll(".crw-category-row");
    for (const row of rows) {
      const input = row.querySelector("[name='rename']");
      const oldName = row.dataset.name;
      const newName = input.value.trim();
      if (!newName || newName === oldName) continue;
      try {
        await renameCategory(oldName, newName);
        row.dataset.name = newName;
      } catch (err) {
        ui.notifications.warn(err.message);
        input.value = oldName;
      }
    }
  }

  async _updateObject(_event, _formData) {
    await this.#applyPendingRenames();
  }
}
