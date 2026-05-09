import { loadAllTemplates } from "../data/npc-loader.js";
import { createNpcFromTemplate } from "../npc/npc-factory.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];
const STAT_ABBRS = { int: "INT", ref: "REF", dex: "DEX", tech: "TECH", cool: "COOL", will: "WILL", luck: "LUCK", move: "MOVE", body: "BODY", emp: "EMP" };
const VISIBLE_SKILLS_COUNT = 8;

const TIER_ORDER = [
  "mooks", "lieutenants", "mini-bosses", "boss",
  "hardened-mooks", "hardened-lieutenants", "hardened-mini-bosses",
  "everyday-people",
];

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
    },
  };

  static PARTS = {
    body: {
      template: "modules/cyberpunk-red-wizards/templates/npc-generator.hbs",
    },
  };

  static #instance = null;

  #templates = [];
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

  async _prepareContext(options) {
    if (this.#templates.length === 0) {
      this.#templates = await loadAllTemplates();
    }

    const { filter, selectedTemplateId, overrides, showAllSkills } = this.#state;

    const searchLower = filter.search.toLowerCase();
    const filtered = this.#templates.filter(t => {
      if (filter.tier !== "all" && t.tier !== filter.tier) return false;
      if (searchLower) {
        const name = game.i18n.localize(t.nameKey).toLowerCase();
        if (!name.includes(searchLower)) return false;
      }
      return true;
    });

    const tierGroups = [];
    for (const tierId of TIER_ORDER) {
      const tierTemplates = filtered.filter(t => t.tier === tierId);
      if (tierTemplates.length === 0) continue;
      tierGroups.push({
        id: tierId,
        label: game.i18n.localize(`crw.npc.tierName.${tierId}`),
        count: tierTemplates.length,
        templates: tierTemplates.map(t => ({
          id: t.id,
          displayName: game.i18n.localize(t.nameKey),
          hp: t.hp,
          sp: Math.max(t.armor.head?.sp ?? 0, t.armor.body?.sp ?? 0),
          topWeapon: t.weapons[0]?.itemName ?? "—",
          selected: t.id === selectedTemplateId,
        })),
      });
    }

    const tiers = TIER_ORDER.map(id => ({
      id,
      label: game.i18n.localize(`crw.npc.tierName.${id}`),
      selected: filter.tier === id,
    }));

    let selected = null;
    if (selectedTemplateId) {
      const template = this.#templates.find(t => t.id === selectedTemplateId);
      if (template) {
        const allSkills = [...template.skills].sort((a, b) => b.base - a.base);
        selected = {
          name: overrides.name ?? game.i18n.localize(template.nameKey),
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

    el.querySelectorAll(".crw-npc-stat-input").forEach(input => {
      input.addEventListener("change", (e) => {
        this.#state.overrides.stats[e.target.dataset.stat] = Number(e.target.value);
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

  async close(options = {}) {
    await super.close(options);
    NpcGeneratorApp.#instance = null;
  }
}
