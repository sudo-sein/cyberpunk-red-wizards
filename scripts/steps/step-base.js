export default class StepBase {
  constructor(id, labelKey) {
    this.id = id;
    this.labelKey = labelKey;
  }

  get label() {
    return game.i18n.localize(this.labelKey);
  }

  get template() {
    throw new Error(`${this.constructor.name} must implement get template()`);
  }

  getTemplate(state) {
    return this.template;
  }

  prepareContext(state) {
    return {};
  }

  activate(html, state, app) {}

  validate(state) {
    return true;
  }

  serialize(html, state) {
    return state;
  }
}
