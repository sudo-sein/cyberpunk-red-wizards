import { TIER_ORDER } from "../data/npc-loader.js";
import { STAT_KEYS } from "../constants.js";
import { calculateHP, calculateSeriousWound } from "../utils/derived-stats.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const ARMOR_OPTIONS = [
  { id: "none", name: "None", sp: 0, packName: "", headItem: "", bodyItem: "" },
  { id: "leathers", name: "Leathers", sp: 4, packName: "core_armor", headItem: "Leathers (Head)", bodyItem: "Leathers (Body)" },
  { id: "kevlar", name: "Kevlar", sp: 7, packName: "core_armor", headItem: "Kevlar® (Head)", bodyItem: "Kevlar® (Body)" },
  { id: "light-armorjack", name: "Light Armorjack", sp: 11, packName: "core_armor", headItem: "Light Armorjack (Head)", bodyItem: "Light Armorjack (Body)" },
  { id: "medium-armorjack", name: "Medium Armorjack", sp: 12, packName: "core_armor", headItem: "Medium Armorjack (Head)", bodyItem: "Medium Armorjack (Body)" },
  { id: "heavy-armorjack", name: "Heavy Armorjack", sp: 13, packName: "core_armor", headItem: "Heavy Armorjack (Head)", bodyItem: "Heavy Armorjack (Body)" },
  { id: "flak", name: "Flak", sp: 15, packName: "core_armor", headItem: "Flak (Head)", bodyItem: "Flak (Body)" },
  { id: "metalgear", name: "Metalgear", sp: 18, packName: "core_armor", headItem: "Metalgear® (Head)", bodyItem: "Metalgear® (Body)" },
];

export const WEAPON_OPTIONS = [
  { id: "heavy-pistol", itemName: "Heavy Pistol", packName: "core_weapons", damage: "3d6" },
  { id: "very-heavy-pistol", itemName: "Very Heavy Pistol", packName: "core_weapons", damage: "4d6" },
  { id: "medium-pistol", itemName: "Medium Pistol", packName: "core_weapons", damage: "2d6" },
  { id: "assault-rifle", itemName: "Assault Rifle", packName: "core_weapons", damage: "5d6" },
  { id: "shotgun", itemName: "Shotgun", packName: "core_weapons", damage: "5d6" },
  { id: "smg", itemName: "SMG", packName: "core_weapons", damage: "2d6" },
  { id: "light-melee", itemName: "Light Melee", packName: "core_weapons", damage: "1d6" },
  { id: "medium-melee", itemName: "Medium Melee", packName: "core_weapons", damage: "2d6" },
  { id: "heavy-melee", itemName: "Heavy Melee", packName: "core_weapons", damage: "3d6" },
];

export const SKILL_OPTIONS = [
  "Accounting", "Acting", "Air Vehicle Tech", "Animal Handling", "Archery",
  "Athletics", "Autofire", "Basic Tech", "Brawling", "Bribery", "Bureaucracy",
  "Business", "Composition", "Conceal/Reveal Object", "Concentration",
  "Contortionist", "Conversation", "Criminology", "Cryptography", "Cybertech",
  "Dance", "Deduction", "Demolitions", "Drive Land Vehicle", "Education",
  "Electronics/Security Tech", "Endurance", "Evasion", "First Aid", "Forgery",
  "Gamble", "Handgun", "Heavy Weapons", "Human Perception", "Interrogation",
  "Land Vehicle Tech", "Library Search", "Lip Reading", "Melee Weapon",
  "Paint/Draw/Sculpt", "Paramedic", "Perception", "Personal Grooming",
  "Persuasion", "Photography/Film", "Pick Lock", "Pick Pocket",
  "Pilot Air Vehicle", "Pilot Sea Vehicle", "Resist Torture/Drugs", "Riding",
  "Sea Vehicle Tech", "Shoulder Arms", "Stealth", "Streetwise", "Tactics",
  "Tracking", "Trading", "Wardrobe & Style", "Weaponstech",
  "Wilderness Survival",
];

export const EQUIPMENT_OPTIONS = [
  { id: "radio-communicator", itemName: "Radio Communicator", packName: "core_gear" },
  { id: "disposable-cell-phone", itemName: "Disposable Cell Phone", packName: "core_gear" },
  { id: "flashlight", itemName: "Flashlight", packName: "core_gear" },
];

export const CYBERWARE_OPTIONS = [
  { id: "neural-link", itemName: "Neural Link", packName: "core_cyberware" },
  { id: "chipware-socket", itemName: "Chipware Socket", packName: "core_cyberware" },
  { id: "cybereye", itemName: "Cybereye", packName: "core_cyberware" },
  { id: "techhair", itemName: "Techhair", packName: "core_cyberware" },
];

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
      tiers: TIER_ORDER.map(id => ({ id, label: game.i18n.localize(`crw.npc.tierName.${id}`), selected: t.tier === id })),
      statRows: [entries.slice(0, 5), entries.slice(5, 10)],
      hp: t.hp,
    };
  }

  #statMax(key) {
    return key === "body" ? 20 : 10;
  }

  #prepareCombat() {
    const t = this.#template;
    const headMatch = this.#matchArmorOption(t.armor.head, "head");
    const bodyMatch = this.#matchArmorOption(t.armor.body, "body");

    return {
      armorOptions: ARMOR_OPTIONS.map(o => ({
        id: o.id,
        label: o.id === "none"
          ? game.i18n.localize("crw.npc.editor.armorNone")
          : `${o.name} (SP ${o.sp})`,
        headSelected: o.id === headMatch,
        bodySelected: o.id === bodyMatch,
      })),
      weapons: t.weapons.map(w => {
        const matchId = WEAPON_OPTIONS.find(o => o.itemName === w.itemName)?.id ?? WEAPON_OPTIONS[0].id;
        return {
          options: WEAPON_OPTIONS.map(o => ({
            id: o.id,
            label: `${o.itemName} (${o.damage})`,
            selected: o.id === matchId,
          })),
        };
      }),
    };
  }

  #prepareSkills() {
    const t = this.#template;
    const usedSkills = new Set(t.skills.map(s => s.name));
    return {
      skills: t.skills.map(s => ({
        name: s.name,
        base: s.base,
        options: SKILL_OPTIONS.map(name => ({
          name,
          selected: name === s.name,
        })),
      })),
      availableCount: SKILL_OPTIONS.length - usedSkills.size,
    };
  }

  #prepareExtras() {
    const t = this.#template;
    return {
      equipment: t.equipment.map(e => {
        const matchId = EQUIPMENT_OPTIONS.find(o => o.itemName === e.itemName)?.id ?? EQUIPMENT_OPTIONS[0].id;
        return {
          quantity: e.quantity ?? 1,
          options: EQUIPMENT_OPTIONS.map(o => ({
            id: o.id,
            label: o.itemName,
            selected: o.id === matchId,
          })),
        };
      }),
      cyberware: t.cyberware.map(c => {
        const matchId = CYBERWARE_OPTIONS.find(o => o.itemName === c.itemName)?.id ?? CYBERWARE_OPTIONS[0].id;
        return {
          options: CYBERWARE_OPTIONS.map(o => ({
            id: o.id,
            label: o.itemName,
            selected: o.id === matchId,
          })),
        };
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
    for (const opt of ARMOR_OPTIONS) {
      if (opt.id === "none") continue;
      if (armorSlot.itemName === opt[itemKey]) return opt.id;
    }
    return "none";
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
        const headOpt = ARMOR_OPTIONS.find(o => o.id === headId);
        const bodyOpt = ARMOR_OPTIONS.find(o => o.id === bodyId);
        t.armor.head = headOpt && headOpt.id !== "none"
          ? { name: headOpt.name, sp: headOpt.sp, packName: headOpt.packName, itemName: headOpt.headItem }
          : { name: "", sp: 0, packName: "", itemName: "" };
        t.armor.body = bodyOpt && bodyOpt.id !== "none"
          ? { name: bodyOpt.name, sp: bodyOpt.sp, packName: bodyOpt.packName, itemName: bodyOpt.bodyItem }
          : { name: "", sp: 0, packName: "", itemName: "" };

        t.weapons = [];
        el.querySelectorAll("[name^='weapon-']").forEach(select => {
          const opt = WEAPON_OPTIONS.find(o => o.id === select.value);
          if (opt) t.weapons.push({ packName: opt.packName, itemName: opt.itemName, quality: "standard", damage: opt.damage });
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
        t.equipment = [];
        el.querySelectorAll(".crw-editor-equip-row").forEach(row => {
          const id = row.querySelector("select")?.value;
          const qty = Number(row.querySelector("input[type='number']")?.value) || 1;
          const opt = EQUIPMENT_OPTIONS.find(o => o.id === id);
          if (opt) t.equipment.push({ packName: opt.packName, itemName: opt.itemName, quantity: qty });
        });

        t.cyberware = [];
        el.querySelectorAll(".crw-editor-cyber-row").forEach(row => {
          const id = row.querySelector("select")?.value;
          const opt = CYBERWARE_OPTIONS.find(o => o.id === id);
          if (opt) t.cyberware.push({ packName: opt.packName, itemName: opt.itemName });
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
    const first = WEAPON_OPTIONS[0];
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
    const available = SKILL_OPTIONS.find(s => !used.has(s));
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
    const first = EQUIPMENT_OPTIONS[0];
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
    const first = CYBERWARE_OPTIONS[0];
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
