import StepBase from "./step-base.js";
import { calculateAllDerived } from "../utils/derived-stats.js";

export default class StepDerived extends StepBase {
  constructor() {
    super("derived", "crw.steps.derived");
  }

  get template() {
    return "modules/cyberpunk-red-wizards/templates/steps/derived.hbs";
  }

  prepareContext(state) {
    const d = calculateAllDerived(state.stats);
    const rows = [
      { label: game.i18n.localize("crw.derived.hp"), value: d.hp, formula: game.i18n.localize("crw.derived.hpFormula") },
      { label: game.i18n.localize("crw.derived.seriousWound"), value: d.seriousWound, formula: game.i18n.localize("crw.derived.seriousWoundFormula") },
      { label: game.i18n.localize("crw.derived.deathSave"), value: d.deathSave, formula: game.i18n.localize("crw.derived.deathSaveFormula") },
      { label: game.i18n.localize("crw.derived.humanity"), value: d.humanity, formula: game.i18n.localize("crw.derived.humanityFormula") },
      { label: game.i18n.localize("crw.derived.walk"), value: d.walk, formula: game.i18n.localize("crw.derived.walkFormula") },
      { label: game.i18n.localize("crw.derived.run"), value: d.run, formula: game.i18n.localize("crw.derived.runFormula") },
    ];
    return { derivedRows: rows };
  }

  validate() {
    return true;
  }
}
