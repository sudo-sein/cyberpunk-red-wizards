import { getCategories, UNCATEGORIZED } from "../data/npc-categories.js";
import { STAT_KEYS } from "../constants.js";
import { calculateHP, calculateSeriousWound } from "../utils/derived-stats.js";
import { buildOptions, resolveSelection, PRESERVE_ID } from "../utils/editor-options.js";
import { loadEditorCatalog } from "../data/editor-catalog.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const ROLE_OPTIONS = [
  { id: "none", itemName: "", packName: "" },
  { id: "solo", itemName: "Solo", packName: "core_roles" },
  { id: "netrunner", itemName: "Netrunner", packName: "core_roles" },
  { id: "tech", itemName: "Tech", packName: "core_roles" },
  { id: "medtech", itemName: "Medtech", packName: "core_roles" },
  { id: "media", itemName: "Media", packName: "core_roles" },
  { id: "exec", itemName: "Exec", packName: "core_roles" },
  { id: "lawman", itemName: "Lawman", packName: "core_roles" },
  { id: "fixer", itemName: "Fixer", packName: "core_roles" },
  { id: "nomad", itemName: "Nomad", packName: "core_roles" },
  { id: "rockerboy", itemName: "Rockerboy", packName: "core_roles" },
];

const STEPS = [
  { id: "basics", labelKey: "crw.npc.editor.stepBasics", template: "modules/cyberpunk-red-wizards/templates/npc-editor/basics.hbs" },
  { id: "combat", labelKey: "crw.npc.editor.stepCombat", template: "modules/cyberpunk-red-wizards/templates/npc-editor/combat.hbs" },
  { id: "skills", labelKey: "crw.npc.editor.stepSkills", template: "modules/cyberpunk-red-wizards/templates/npc-editor/skills.hbs" },
  { id: "extras", labelKey: "crw.npc.editor.stepExtras", template: "modules/cyberpunk-red-wizards/templates/npc-editor/extras.hbs" },
];

export class NpcTemplateEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "crw-npc-template-editor",
    classes: ["crw-npc-editor-window"],
    tag: "div",
    window: {
      title: "crw.npc.editor.title",
      icon: "fas fa-edit",
      resizable: true,
    },
    position: {
      width: 600,
      height: 550,
    },
    actions: {
      goToStep: NpcTemplateEditorApp.#onGoToStep,
      prevStep: NpcTemplateEditorApp.#onPrevStep,
      nextStep: NpcTemplateEditorApp.#onNextStep,
      save: NpcTemplateEditorApp.#onSave,
      statInc: NpcTemplateEditorApp.#onStatInc,
      statDec: NpcTemplateEditorApp.#onStatDec,
      calcHp: NpcTemplateEditorApp.#onCalcHp,
      addWeapon: NpcTemplateEditorApp.#onAddWeapon,
      removeWeapon: NpcTemplateEditorApp.#onRemoveWeapon,
      addSkill: NpcTemplateEditorApp.#onAddSkill,
      removeSkill: NpcTemplateEditorApp.#onRemoveSkill,
      addEquip: NpcTemplateEditorApp.#onAddEquip,
      removeEquip: NpcTemplateEditorApp.#onRemoveEquip,
      addCyber: NpcTemplateEditorApp.#onAddCyber,
      removeCyber: NpcTemplateEditorApp.#onRemoveCyber,
    },
  };

  static PARTS = {
    body: {
      template: "modules/cyberpunk-red-wizards/templates/npc-template-editor.hbs",
    },
  };

  #template;
  #onSaveCallback;
  #currentStep = 0;

  constructor(template, onSaveCallback) {
    super();
    this.#template = JSON.parse(JSON.stringify(template));
    this.#onSaveCallback = onSaveCallback;
  }

  static open(template, onSaveCallback) {
    new NpcTemplateEditorApp(template, onSaveCallback).render(true);
  }

  async _prepareContext() {
    const content = this.element?.querySelector(".crw-editor-scroll");
    this._savedScrollTop = content?.scrollTop ?? null;

    this._catalog = await loadEditorCatalog();

    const stepDef = STEPS[this.#currentStep];
    let stepContext = {};

    switch (this.#currentStep) {
      case 0: stepContext = this.#prepareBasics(); break;
      case 1: stepContext = this.#prepareCombat(); break;
      case 2: stepContext = this.#prepareSkills(); break;
      case 3: stepContext = this.#prepareExtras(); break;
    }

    const stepHtml = await renderTemplate(stepDef.template, stepContext);

    return {
      steps: STEPS.map(s => ({ id: s.id, label: game.i18n.localize(s.labelKey) })),
      currentStep: this.#currentStep,
      stepHtml,
      isFinalStep: this.#currentStep === STEPS.length - 1,
    };
  }

  _onRender() {
    if (this._savedScrollTop != null) {
      const content = this.element.querySelector(".crw-editor-scroll");
      if (content) content.scrollTop = this._savedScrollTop;
      this._savedScrollTop = null;
    }
  }

  #prepareBasics() {
    const t = this.#template;
    const entries = STAT_KEYS.map(key => ({
      key,
      abbr: game.i18n.localize(`crw.stats.${key}`),
      value: t.stats[key],
    }));
    return {
      name: t.name ?? "",
      tiers: this.#categoryOptions(t.tier),
      statRows: [entries.slice(0, 5), entries.slice(5, 10)],
      hp: t.hp,
    };
  }

  #categoryOptions(current) {
    const categories = getCategories();
    const options = categories.map(name => ({ id: name, label: name, selected: name === current }));
    // Preserve an off-list current value (e.g. Uncategorized or a deleted category)
    // so opening + saving the editor never silently relocates the template.
    if (current && !categories.includes(current)) {
      options.push({ id: current, label: current, selected: true });
    } else if (!current) {
      options.push({ id: UNCATEGORIZED, label: UNCATEGORIZED, selected: true });
    }
    return options;
  }

  #statMax(key) {
    return key === "body" ? 20 : 10;
  }

  #prepareCombat() {
    const t = this.#template;
    const armorOptions = this._catalog.armor;
    // Build a per-slot armor option list so an unknown (preserved) item in one
    // slot shows its own correct label, independent of the other slot.
    const armorSlotOptions = (match, slot) => {
      const rows = armorOptions.map(o => ({
        id: o.id,
        label: o.id === "none" ? game.i18n.localize("crw.npc.editor.armorNone") : `${o.name} (SP ${o.sp})`,
        selected: o.id === match,
      }));
      if (match === PRESERVE_ID) {
        rows.push({ id: PRESERVE_ID, label: slot?.itemName || "(current)", selected: true });
      }
      return rows;
    };
    return {
      headArmorOptions: armorSlotOptions(this.#matchArmorOption(t.armor.head, "head"), t.armor.head),
      bodyArmorOptions: armorSlotOptions(this.#matchArmorOption(t.armor.body, "body"), t.armor.body),
      weapons: t.weapons.map(w => {
        const { options } = buildOptions(
          this._catalog.weapons.map(o => ({ ...o, label: o.damage ? `${o.itemName} (${o.damage})` : o.itemName })),
          w, o => o.id, "label",
        );
        return { options };
      }),
    };
  }

  #prepareSkills() {
    const t = this.#template;
    const skillOptions = this._catalog.skills;
    const usedSkills = new Set(t.skills.map(s => s.name));
    return {
      skills: t.skills.map(s => ({
        name: s.name,
        base: s.base,
        options: skillOptions.map(name => ({
          name,
          selected: name === s.name,
        })),
      })),
      availableCount: skillOptions.length - usedSkills.size,
    };
  }

  #prepareExtras() {
    const t = this.#template;
    return {
      equipment: t.equipment.map(e => {
        const { options } = buildOptions(
          this._catalog.equipment.map(o => ({ ...o, label: o.itemName })),
          e, o => o.id, "label",
        );
        return { quantity: e.quantity ?? 1, options };
      }),
      cyberware: t.cyberware.map(c => {
        const { options } = buildOptions(
          this._catalog.cyberware.map(o => ({ ...o, label: o.itemName })),
          c, o => o.id, "label",
        );
        return { options };
      }),
      roleOptions: ROLE_OPTIONS.map(o => ({
        id: o.id,
        label: o.id === "none" ? game.i18n.localize("crw.npc.editor.armorNone") : o.itemName,
        selected: o.itemName === (t.role?.itemName ?? ""),
      })),
      roleRank: t.role?.rank ?? 0,
    };
  }

  #matchArmorOption(armorSlot, type) {
    if (!armorSlot?.packName) return "none";
    const itemKey = type === "head" ? "headItem" : "bodyItem";
    for (const opt of this._catalog.armor) {
      if (opt.id === "none") continue;
      if (armorSlot.itemName === opt[itemKey]) return opt.id;
    }
    return PRESERVE_ID;
  }

  #readCurrentStep() {
    const el = this.element;
    if (!el) return;
    const t = this.#template;

    switch (this.#currentStep) {
      case 0: {
        t.name = el.querySelector("[name='name']")?.value ?? t.name;
        t.tier = el.querySelector("[name='tier']")?.value ?? t.tier;
        t.hp = Number(el.querySelector("[name='hp']")?.value) || 0;
        t.seriousWound = calculateSeriousWound(t.hp);
        t.deathSave = t.stats.body;
        break;
      }
      case 1: {
        const headId = el.querySelector("[name='armorHead']")?.value ?? "none";
        const bodyId = el.querySelector("[name='armorBody']")?.value ?? "none";
        const prevHead = t.armor.head, prevBody = t.armor.body;
        const headOpt = this._catalog.armor.find(o => o.id === headId);
        const bodyOpt = this._catalog.armor.find(o => o.id === bodyId);
        t.armor.head = headId === PRESERVE_ID ? prevHead
          : headOpt && headOpt.id !== "none"
            ? { name: headOpt.name, sp: headOpt.sp, packName: headOpt.packName, itemName: headOpt.headItem }
            : { name: "", sp: 0, packName: "", itemName: "" };
        t.armor.body = bodyId === PRESERVE_ID ? prevBody
          : bodyOpt && bodyOpt.id !== "none"
            ? { name: bodyOpt.name, sp: bodyOpt.sp, packName: bodyOpt.packName, itemName: bodyOpt.bodyItem }
            : { name: "", sp: 0, packName: "", itemName: "" };

        const prevWeapons = t.weapons;
        t.weapons = [];
        el.querySelectorAll("[name^='weapon-']").forEach((select, i) => {
          if (select.value === PRESERVE_ID) {
            if (prevWeapons[i]) t.weapons.push(prevWeapons[i]);
            return;
          }
          const resolved = resolveSelection(select.value, this._catalog.weapons);
          if (resolved) t.weapons.push({ packName: resolved.packName, itemName: resolved.itemName, quality: "standard", damage: resolved.damage });
        });
        break;
      }
      case 2: {
        t.skills = [];
        el.querySelectorAll(".crw-editor-skill-row").forEach(row => {
          const name = row.querySelector("select")?.value;
          const base = Number(row.querySelector("input[type='number']")?.value) || 0;
          if (name) t.skills.push({ name, base });
        });
        break;
      }
      case 3: {
        const prevEquip = t.equipment;
        t.equipment = [];
        el.querySelectorAll(".crw-editor-equip-row").forEach((row, i) => {
          const id = row.querySelector("select")?.value;
          const qty = Number(row.querySelector("input[type='number']")?.value) || 1;
          if (id === PRESERVE_ID) {
            if (prevEquip[i]) t.equipment.push({ ...prevEquip[i], quantity: qty });
            return;
          }
          const resolved = resolveSelection(id, this._catalog.equipment);
          if (resolved) t.equipment.push({ packName: resolved.packName, itemName: resolved.itemName, quantity: qty });
        });

        const prevCyber = t.cyberware;
        t.cyberware = [];
        el.querySelectorAll(".crw-editor-cyber-row").forEach((row, i) => {
          const id = row.querySelector("select")?.value;
          if (id === PRESERVE_ID) {
            if (prevCyber[i]) t.cyberware.push(prevCyber[i]);
            return;
          }
          const resolved = resolveSelection(id, this._catalog.cyberware);
          if (resolved) t.cyberware.push({ packName: resolved.packName, itemName: resolved.itemName });
        });

        const roleId = el.querySelector("[name='role']")?.value ?? "none";
        const roleRank = Number(el.querySelector("[name='roleRank']")?.value) || 0;
        const roleOpt = ROLE_OPTIONS.find(o => o.id === roleId);
        t.role = (roleOpt && roleOpt.id !== "none")
          ? { packName: roleOpt.packName, itemName: roleOpt.itemName, rank: roleRank }
          : null;
        break;
      }
    }
  }

  static #onGoToStep(event, target) {
    const step = Number(target.dataset.step);
    if (!Number.isInteger(step) || step < 0 || step >= STEPS.length) return;
    if (step === this.#currentStep) return;
    this.#readCurrentStep();
    this.#currentStep = step;
    this.render(true);
  }

  static #onStatInc(event, target) {
    const key = target.dataset.stat;
    if (!key || !(key in this.#template.stats)) return;
    this.#readCurrentStep();
    if (this.#template.stats[key] < this.#statMax(key)) {
      this.#template.stats[key]++;
      this.render(true);
    }
  }

  static #onStatDec(event, target) {
    const key = target.dataset.stat;
    if (!key || !(key in this.#template.stats)) return;
    this.#readCurrentStep();
    if (this.#template.stats[key] > 0) {
      this.#template.stats[key]--;
      this.render(true);
    }
  }

  static #onCalcHp() {
    this.#readCurrentStep();
    const { body, will } = this.#template.stats;
    this.#template.hp = calculateHP(body, will);
    this.#template.seriousWound = calculateSeriousWound(this.#template.hp);
    this.render(true);
  }

  static #onPrevStep() {
    this.#readCurrentStep();
    if (this.#currentStep > 0) {
      this.#currentStep--;
      this.render(true);
    }
  }

  static #onNextStep() {
    this.#readCurrentStep();
    if (this.#currentStep < STEPS.length - 1) {
      this.#currentStep++;
      this.render(true);
    }
  }

  static async #onSave() {
    this.#readCurrentStep();
    if (this.#onSaveCallback) this.#onSaveCallback(this.#template);
    await this.close();
  }

  static #onAddWeapon() {
    this.#readCurrentStep();
    const first = this._catalog.weapons[0];
    if (!first) return;
    this.#template.weapons.push({ packName: first.packName, itemName: first.itemName, quality: "standard", damage: first.damage });
    this.render(true);
  }

  static #onRemoveWeapon(event, target) {
    this.#readCurrentStep();
    const idx = Number(target.dataset.index);
    this.#template.weapons.splice(idx, 1);
    this.render(true);
  }

  static #onAddSkill() {
    this.#readCurrentStep();
    const used = new Set(this.#template.skills.map(s => s.name));
    const available = this._catalog.skills.find(s => !used.has(s));
    if (available) {
      this.#template.skills.push({ name: available, base: 0 });
      this.render(true);
    }
  }

  static #onRemoveSkill(event, target) {
    this.#readCurrentStep();
    const idx = Number(target.dataset.index);
    this.#template.skills.splice(idx, 1);
    this.render(true);
  }

  static #onAddEquip() {
    this.#readCurrentStep();
    const first = this._catalog.equipment[0];
    if (!first) return;
    this.#template.equipment.push({ packName: first.packName, itemName: first.itemName, quantity: 1 });
    this.render(true);
  }

  static #onRemoveEquip(event, target) {
    this.#readCurrentStep();
    const idx = Number(target.dataset.index);
    this.#template.equipment.splice(idx, 1);
    this.render(true);
  }

  static #onAddCyber() {
    this.#readCurrentStep();
    const first = this._catalog.cyberware[0];
    if (!first) return;
    this.#template.cyberware.push({ packName: first.packName, itemName: first.itemName });
    this.render(true);
  }

  static #onRemoveCyber(event, target) {
    this.#readCurrentStep();
    const idx = Number(target.dataset.index);
    this.#template.cyberware.splice(idx, 1);
    this.render(true);
  }
}
