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
        await reorderCategory(row.dataset.name, dir);
        this.render(true);
      });
    });

    el.querySelectorAll("[data-action='remove']").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const row = e.currentTarget.closest(".crw-category-row");
        await removeCategory(row.dataset.name);
        this.render(true);
      });
    });

    el.querySelector("[data-action='add']")?.addEventListener("click", async () => {
      const input = el.querySelector("[name='newCategory']");
      try {
        await addCategory(input.value);
        this.render(true);
      } catch (err) {
        ui.notifications.warn(err.message);
      }
    });
  }

  async _updateObject(_event, formData) {
    // Apply any pending renames from the text inputs (data-name is the old value).
    const rows = this.element[0].querySelectorAll(".crw-category-row");
    for (const row of rows) {
      const oldName = row.dataset.name;
      const newName = row.querySelector("[name='rename']").value.trim();
      if (newName && newName !== oldName) {
        try {
          await renameCategory(oldName, newName);
        } catch (err) {
          ui.notifications.warn(err.message);
        }
      }
    }
  }
}
