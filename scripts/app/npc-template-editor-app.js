import { TIER_ORDER } from "../data/npc-loader.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const STAT_KEYS = ["int", "ref", "dex", "tech", "cool", "will", "luck", "move", "body", "emp"];

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
      height: 700,
    },
    actions: {
      save: NpcTemplateEditorApp.#onSave,
      cancel: NpcTemplateEditorApp.#onCancel,
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

  constructor(template, onSaveCallback) {
    super();
    this.#template = JSON.parse(JSON.stringify(template));
    this.#onSaveCallback = onSaveCallback;
  }

  static open(template, onSaveCallback) {
    new NpcTemplateEditorApp(template, onSaveCallback).render(true);
  }

  async _prepareContext() {
    const t = this.#template;
    return {
      name: t.name ?? "",
      tiers: TIER_ORDER.map(id => ({ id, label: game.i18n.localize(`crw.npc.tierName.${id}`), selected: t.tier === id })),
      stats: STAT_KEYS.map(key => ({ key, abbr: key.toUpperCase(), value: t.stats[key] })),
      hp: t.hp,
      seriousWound: t.seriousWound,
      deathSave: t.deathSave,
      armorHeadPack: t.armor.head?.packName ?? "",
      armorHeadItem: t.armor.head?.itemName ?? "",
      armorHeadSp: t.armor.head?.sp ?? 0,
      armorBodyPack: t.armor.body?.packName ?? "",
      armorBodyItem: t.armor.body?.itemName ?? "",
      armorBodySp: t.armor.body?.sp ?? 0,
      weapons: t.weapons,
      skills: t.skills,
      equipment: t.equipment,
      cyberware: t.cyberware,
      rolePack: t.role?.packName ?? "",
      roleItem: t.role?.itemName ?? "",
      roleRank: t.role?.rank ?? 0,
    };
  }

  #readFormIntoTemplate() {
    const el = this.element;
    const t = this.#template;
    t.name = el.querySelector("[name='name']").value;
    t.tier = el.querySelector("[name='tier']").value;

    for (const key of STAT_KEYS) {
      t.stats[key] = Number(el.querySelector(`[name='stat-${key}']`).value) || 0;
    }
    t.hp = Number(el.querySelector("[name='hp']").value) || 0;
    t.seriousWound = Math.floor(t.hp / 2);
    t.deathSave = t.stats.body;

    t.armor.head = {
      name: el.querySelector("[name='armorHeadItem']").value,
      sp: Number(el.querySelector("[name='armorHeadSp']").value) || 0,
      packName: el.querySelector("[name='armorHeadPack']").value,
      itemName: el.querySelector("[name='armorHeadItem']").value,
    };
    t.armor.body = {
      name: el.querySelector("[name='armorBodyItem']").value,
      sp: Number(el.querySelector("[name='armorBodySp']").value) || 0,
      packName: el.querySelector("[name='armorBodyPack']").value,
      itemName: el.querySelector("[name='armorBodyItem']").value,
    };

    t.weapons = [];
    el.querySelectorAll(".crw-editor-weapon-row").forEach(row => {
      t.weapons.push({
        packName: row.querySelector("[name='weaponPack']").value,
        itemName: row.querySelector("[name='weaponItem']").value,
        quality: row.querySelector("[name='weaponQuality']").value,
        damage: row.querySelector("[name='weaponDamage']").value,
      });
    });

    t.skills = [];
    el.querySelectorAll(".crw-editor-skill-row").forEach(row => {
      t.skills.push({
        name: row.querySelector("[name='skillName']").value,
        base: Number(row.querySelector("[name='skillBase']").value) || 0,
      });
    });

    t.equipment = [];
    el.querySelectorAll(".crw-editor-equip-row").forEach(row => {
      t.equipment.push({
        packName: row.querySelector("[name='equipPack']").value,
        itemName: row.querySelector("[name='equipItem']").value,
        quantity: Number(row.querySelector("[name='equipQty']").value) || 1,
      });
    });

    t.cyberware = [];
    el.querySelectorAll(".crw-editor-cyber-row").forEach(row => {
      t.cyberware.push({
        packName: row.querySelector("[name='cyberPack']").value,
        itemName: row.querySelector("[name='cyberItem']").value,
      });
    });

    const rolePack = el.querySelector("[name='rolePack']").value;
    const roleItem = el.querySelector("[name='roleItem']").value;
    const roleRank = Number(el.querySelector("[name='roleRank']").value) || 0;
    t.role = (rolePack && roleItem) ? { packName: rolePack, itemName: roleItem, rank: roleRank } : null;
  }

  static async #onSave() {
    this.#readFormIntoTemplate();
    if (this.#onSaveCallback) this.#onSaveCallback(this.#template);
    await this.close();
  }

  static async #onCancel() {
    await this.close();
  }

  static #onAddWeapon() {
    this.#readFormIntoTemplate();
    this.#template.weapons.push({ packName: "core_weapons", itemName: "", quality: "standard", damage: "" });
    this.render(true);
  }

  static #onRemoveWeapon(event, target) {
    this.#readFormIntoTemplate();
    const idx = Number(target.dataset.index);
    this.#template.weapons.splice(idx, 1);
    this.render(true);
  }

  static #onAddSkill() {
    this.#readFormIntoTemplate();
    this.#template.skills.push({ name: "", base: 0 });
    this.render(true);
  }

  static #onRemoveSkill(event, target) {
    this.#readFormIntoTemplate();
    const idx = Number(target.dataset.index);
    this.#template.skills.splice(idx, 1);
    this.render(true);
  }

  static #onAddEquip() {
    this.#readFormIntoTemplate();
    this.#template.equipment.push({ packName: "core_gear", itemName: "", quantity: 1 });
    this.render(true);
  }

  static #onRemoveEquip(event, target) {
    this.#readFormIntoTemplate();
    const idx = Number(target.dataset.index);
    this.#template.equipment.splice(idx, 1);
    this.render(true);
  }

  static #onAddCyber() {
    this.#readFormIntoTemplate();
    this.#template.cyberware.push({ packName: "core_cyberware", itemName: "" });
    this.render(true);
  }

  static #onRemoveCyber(event, target) {
    this.#readFormIntoTemplate();
    const idx = Number(target.dataset.index);
    this.#template.cyberware.splice(idx, 1);
    this.render(true);
  }
}
