import { test } from "node:test";
import { rejects, strictEqual } from "node:assert/strict";
import { commitCart, CommitError } from "../../scripts/improvement/commit-cart.js";

function makeRoleItem({ id, name, rank = 0 }) {
  return {
    id,
    name,
    type: "role",
    system: { rank },
  };
}

function makeActor({ roleItem, ip = 10_000, updateDelay } = {}) {
  const items = new Map();
  if (roleItem) items.set(roleItem.id, roleItem);

  return {
    id: "actor-1",
    items,
    system: { improvementPoints: { value: ip } },
    async createEmbeddedDocuments() {},
    async updateEmbeddedDocuments() {
      if (updateDelay) await updateDelay();
    },
    deltaLedgerProperty() {},
  };
}

test("commitCart blocks concurrent commit on same actor", async () => {
  globalThis.game = {
    i18n: {
      format: (key, data = {}) => `${key}:${JSON.stringify(data)}`,
      localize: (key) => key,
    },
  };

  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });

  const actor = makeActor({
    roleItem: makeRoleItem({ id: "role-1", name: "Solo", rank: 1 }),
    updateDelay: async () => wait,
  });

  const cart = {
    skills: new Map(),
    roles: new Map([["role-1", 1]]),
    newRoles: new Map(),
  };

  const first = commitCart(actor, cart);
  await rejects(
    commitCart(actor, cart),
    (err) => err instanceof CommitError && err.code === "COMMIT_IN_PROGRESS"
  );
  release();
  await first;
});

test("commitCart returns friendly labels for missing items", async () => {
  globalThis.game = {
    i18n: {
      format: (key, data = {}) => `${key}:${JSON.stringify(data)}`,
      localize: (key) => {
        if (key === "crw.improvement.labels.skill") return "Skill";
        if (key === "crw.improvement.labels.role") return "Role";
        return key;
      },
    },
  };

  const actor = makeActor({ roleItem: makeRoleItem({ id: "role-1", name: "Solo", rank: 1 }) });

  const result = await commitCart(actor, {
    skills: new Map([["deleted-skill-id", 1]]),
    roles: new Map([["role-1", 1], ["deleted-role-id", 1]]),
    newRoles: new Map(),
  });

  strictEqual(result.warnings[0].name, "Skill");
  strictEqual(result.warnings[1].name, "Role");
});
