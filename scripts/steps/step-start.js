import StepBase from "./step-base.js";

const ROLES = [
  "rockerboy", "solo", "netrunner", "tech", "medtech",
  "media", "lawman", "exec", "fixer", "nomad"
];

const METHODS = [
  { id: "streetrat", labelKey: "crw.methods.streetrat", descKey: "crw.start.method.streetrat.desc", timeKey: "crw.start.method.streetrat.time" },
  { id: "edgerunner", labelKey: "crw.methods.edgerunner", descKey: "crw.start.method.edgerunner.desc", timeKey: "crw.start.method.edgerunner.time" },
  { id: "complete", labelKey: "crw.methods.complete", descKey: "crw.start.method.complete.desc", timeKey: "crw.start.method.complete.time" },
];

export default class StepStart extends StepBase {
  constructor() {
    super("start", "crw.steps.start");
  }

  get template() {
    return "modules/cyberpunk-red-wizards/templates/steps/start.hbs";
  }

  prepareContext(state) {
    return {
      handle: state.handle,
      selectedMethod: state.method,
      selectedRole: state.role?.id ?? null,
      methods: METHODS.map(m => ({
        id: m.id,
        label: game.i18n.localize(m.labelKey),
        desc: game.i18n.localize(m.descKey),
        time: game.i18n.localize(m.timeKey),
      })),
      roles: ROLES.map(r => ({
        id: r,
        label: game.i18n.localize(`crw.roles.${r}`),
        ability: game.i18n.localize(`crw.roles.${r}.ability`),
      })),
    };
  }

  activate(html, state, app) {
    html.querySelectorAll("[data-action='selectMethod']").forEach(el => {
      el.addEventListener("click", () => {
        const method = el.dataset.method;
        if (state.method !== method) {
          state.method = method;
          state.stats = { int: 2, ref: 2, dex: 2, tech: 2, cool: 2, will: 2, luck: 2, move: 2, body: 2, emp: 2 };
          state.skills = [];
          state.gear = {};
          state.cyberware = [];
        }
        app.render(true);
      });
    });

    html.querySelectorAll("[data-action='selectRole']").forEach(el => {
      el.addEventListener("click", () => {
        const roleId = el.dataset.role;
        if (state.role?.id !== roleId) {
          state.role = { id: roleId };
          state.lifepath = {};
          state.stats = { int: 2, ref: 2, dex: 2, tech: 2, cool: 2, will: 2, luck: 2, move: 2, body: 2, emp: 2 };
          state.skills = [];
          state.gear = {};
          state.cyberware = [];
        }
        app.render(true);
      });
    });

    const handleInput = html.querySelector(".crw-handle-input");
    if (handleInput) {
      handleInput.addEventListener("input", (e) => {
        state.handle = e.target.value.trim();
        const nextBtn = html.querySelector(".crw-btn-next");
        if (nextBtn) nextBtn.disabled = !this.validate(state);
      });
    }
  }

  validate(state) {
    return state.handle.length > 0 && state.method && state.role?.id;
  }

  serialize(html, state) {
    const handleInput = html.querySelector(".crw-handle-input");
    if (handleInput) state.handle = handleInput.value.trim();
    return state;
  }
}
