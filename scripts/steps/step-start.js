import StepBase from "./step-base.js";
import {
  getEffectiveCreatorPointBudgets,
  getStatPointBudget,
} from "../utils/creator-settings.js";

const HANDLES_FILE_PATH = "modules/cyberpunk-red-wizards/data/handles.txt";
let handlesCachePromise = null;

function parseHandlesFile(content) {
  const result = { optionalPartial: [], handles: [] };
  let section = null;
  const lines = String(content ?? "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const normalized = line.toLowerCase();

    if (normalized === "optional_partial") {
      section = "optionalPartial";
      continue;
    }

    if (normalized === "handles") {
      section = "handles";
      continue;
    }

    if (section) result[section].push(line);
  }

  return result;
}

async function loadHandlesData() {
  if (handlesCachePromise) return handlesCachePromise;

  handlesCachePromise = fetch(HANDLES_FILE_PATH)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load handles list: ${response.status}`);
      return response.text();
    })
    .then(parseHandlesFile)
    .catch((error) => {
      console.error("CRW | Failed to load random handles list", error);
      return { optionalPartial: [], handles: [] };
    });

  return handlesCachePromise;
}

function pickRandom(items) {
  if (!Array.isArray(items) || !items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function generateRandomHandle({ optionalPartial, handles }) {
  const handle = pickRandom(handles);
  if (!handle) return "";

  const usePrefix = Array.isArray(optionalPartial) && optionalPartial.length > 0 && Math.random() < 0.5;
  if (!usePrefix) return handle;

  const prefix = pickRandom(optionalPartial);
  return prefix ? `${prefix}${handle}` : handle;
}

const ROLES = [
  "rockerboy", "solo", "netrunner", "tech", "medtech",
  "media", "lawman", "exec", "fixer", "nomad"
];

const METHODS = [
  { id: "streetrat", labelKey: "crw.methods.streetrat", descKey: "crw.start.method.streetrat.desc", timeKey: "crw.start.method.streetrat.time" },
  { id: "edgerunner", labelKey: "crw.methods.edgerunner", descKey: "crw.start.method.edgerunner.desc", timeKey: "crw.start.method.edgerunner.time" },
  { id: "complete", labelKey: "crw.methods.complete", descKey: "crw.start.method.complete.desc", timeKey: "crw.start.method.complete.time" },
];

const STAT_BUDGET_OVERRIDES = [
  { value: 50, labelKey: "crw.start.statBudgetOverride.backgroundCharacter" },
  { value: 62, labelKey: "crw.start.statBudgetOverride.startingCharacter" },
  { value: 70, labelKey: "crw.start.statBudgetOverride.majorCharacter" },
  { value: 75, labelKey: "crw.start.statBudgetOverride.minorHero" },
  { value: 80, labelKey: "crw.start.statBudgetOverride.majorHero" },
];

function buildStatBudgetOverrides() {
  const configuredBudget = getStatPointBudget();
  const options = [...STAT_BUDGET_OVERRIDES];

  if (!options.some((option) => option.value === configuredBudget)) {
    options.push({
      value: configuredBudget,
      labelKey: "crw.start.statBudgetOverride.customBudget",
    });
  }

  options.sort((a, b) => a.value - b.value);
  return options;
}

export default class StepStart extends StepBase {
  constructor() {
    super("start", "crw.steps.start");
  }

  get template() {
    return "modules/cyberpunk-red-wizards/templates/steps/start.hbs";
  }

  prepareContext(state) {
    const budgets = getEffectiveCreatorPointBudgets(state);
    const statBudgetOverrides = buildStatBudgetOverrides();
    return {
      handle: state.handle,
      selectedMethod: state.method,
      selectedRole: state.role?.id ?? null,
      methods: METHODS.map(m => ({
        id: m.id,
        label: game.i18n.localize(m.labelKey),
        desc: game.i18n.format(m.descKey, {
          statPointsTotal: budgets.statPointBudget,
          skillPointsTotal: budgets.skillPointBudget,
        }),
        time: game.i18n.localize(m.timeKey),
      })),
      roles: ROLES.map(r => ({
        id: r,
        label: game.i18n.localize(`crw.roles.${r}`),
        ability: game.i18n.localize(`crw.roleAbility.${r}`),
      })),
      showStatBudgetOverride: game.user.isGM,
      statBudgetOverrideColumns: statBudgetOverrides.length,
      statBudgetOverrides: statBudgetOverrides.map((option) => ({
        value: option.value,
        label: game.i18n.localize(option.labelKey),
        selected: state.statPointBudgetOverride === option.value,
      })),
    };
  }

  activate(html, state, app) {
    const handleInput = html.querySelector(".crw-handle-input");

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

    html.querySelectorAll("[data-action='selectStatBudgetOverride']").forEach(el => {
      el.addEventListener("click", () => {
        state.statPointBudgetOverride = parseInt(el.dataset.budget, 10);
        app.render(true);
      });
    });

    const randomHandleBtn = html.querySelector("[data-action='randomHandle']");
    if (randomHandleBtn && handleInput) {
      randomHandleBtn.addEventListener("click", async () => {
        const handlesData = await loadHandlesData();
        const randomHandle = generateRandomHandle(handlesData);
        if (!randomHandle) return;

        handleInput.value = randomHandle;
        handleInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

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
