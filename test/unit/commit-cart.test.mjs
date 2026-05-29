import { test } from "node:test";
import { deepStrictEqual, rejects, strictEqual } from "node:assert/strict";
import { commitCart, CommitError } from "../../scripts/improvement/commit-cart.js";
import { fetchRoleItemData } from "../../scripts/improvement/compendium-roles.js";

function makeItem({ id, name, type, system = {}, sourceId }) {
  return {
    id,
    name,
    type,
    system,
    getFlag: (scope, key) => {
      if (scope === "core" && key === "sourceId") return sourceId ?? null;
      return null;
    },
  };
}

function makeRoleItem({ id, name, rank = 0, sourceId } = {}) {
  return makeItem({ id, name, type: "role", system: { rank }, sourceId });
}

function makeSkillItem({ id, name, level = 0, difficulty = "typical" } = {}) {
  return makeItem({ id, name, type: "skill", system: { level, difficulty } });
}

function makeActor({ items: itemList = [], roleItem, skillItem, ip = 10_000, updateDelay, actorUpdateDelay } = {}) {
  const items = new Map();
  for (const item of itemList) items.set(item.id, item);
  if (roleItem) items.set(roleItem.id, roleItem);
  if (skillItem) items.set(skillItem.id, skillItem);

  return {
    id: "actor-1",
    items,
    system: { improvementPoints: { value: ip, transactions: [] } },
    created: [],
    updates: [],
    async createEmbeddedDocuments(type, docs) {
      this.created.push({ type, docs });
    },
    async updateEmbeddedDocuments(type, updates) {
      if (updateDelay) await updateDelay();
      this.updates.push({ type, updates });
    },
    async update(data) {
      if (actorUpdateDelay) await actorUpdateDelay();
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
  };
}

function mockGetProperty(obj, path) {
  return path.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
}
function mockSetProperty(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function installGame({ fetchedRole } = {}) {
  globalThis.foundry = { utils: { getProperty: mockGetProperty, setProperty: mockSetProperty } };
  globalThis.game = {
    i18n: {
      format: (key, data = {}) => `${key}:${JSON.stringify(data)}`,
      localize: (key) => {
        if (key === "crw.improvement.labels.skill") return "Skill";
        if (key === "crw.improvement.labels.role") return "Role";
        return key;
      },
    },
    packs: new Map([
      ["cyberpunk-red-core.core_roles", {
        async getDocument(id) {
          if (!fetchedRole) return null;
          return {
            toObject: () => ({
              _id: id,
              name: fetchedRole.name ?? "Solo",
              type: fetchedRole.type ?? "role",
              system: { ...(fetchedRole.system ?? {}) },
              flags: fetchedRole.flags ?? { core: { sourceId: `Compendium.cyberpunk-red-core.core_roles.${id}` } },
            }),
          };
        },
      }],
    ]),
  };
}

test("commitCart blocks concurrent commit on same actor", async () => {
  installGame();

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
  installGame();

  const actor = makeActor({ roleItem: makeRoleItem({ id: "role-1", name: "Solo", rank: 1 }) });

  const result = await commitCart(actor, {
    skills: new Map([["deleted-skill-id", 1]]),
    roles: new Map([["role-1", 1], ["deleted-role-id", 1]]),
    newRoles: new Map(),
  });

  deepStrictEqual(result.warnings.map((warning) => warning.name).sort(), ["Role", "Skill"]);
});

test("commitCart awaits actor IP update before resolving", async () => {
  installGame();

  let updateResolved = false;
  const actor = makeActor({
    skillItem: makeSkillItem({ id: "skill-1", name: "Athletics", level: 1 }),
    actorUpdateDelay: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      updateResolved = true;
    },
  });

  await commitCart(actor, {
    skills: new Map([["skill-1", 1]]),
    roles: new Map(),
    newRoles: new Map(),
  });

  strictEqual(updateResolved, true);
  strictEqual(actor.system.improvementPoints.transactions.length, 1);
});

test("commitCart rejects skill entries that point to non-skill items", async () => {
  installGame();
  const actor = makeActor({ roleItem: makeRoleItem({ id: "role-1", name: "Solo", rank: 1 }) });

  await rejects(
    commitCart(actor, { skills: new Map([["role-1", 1]]), roles: new Map(), newRoles: new Map() }),
    (err) => err instanceof CommitError && err.code === "INVALID_CART"
  );
});

test("commitCart rejects role entries that point to non-role items", async () => {
  installGame();
  const actor = makeActor({
    skillItem: makeSkillItem({ id: "skill-1", name: "Athletics", level: 1 }),
    roleItem: makeRoleItem({ id: "role-1", name: "Solo", rank: 1 }),
  });

  await rejects(
    commitCart(actor, { skills: new Map(), roles: new Map([["skill-1", 1]]), newRoles: new Map() }),
    (err) => err instanceof CommitError && err.code === "INVALID_CART"
  );
});

test("commitCart rejects invalid deltas and planned ranks", async () => {
  installGame({ fetchedRole: { name: "Solo" } });
  const actor = makeActor({
    skillItem: makeSkillItem({ id: "skill-1", name: "Athletics", level: 1 }),
    roleItem: makeRoleItem({ id: "role-1", name: "Solo", rank: 1 }),
  });

  for (const delta of [0, -1, 1.5, Number.NaN]) {
    await rejects(
      commitCart(actor, { skills: new Map([["skill-1", delta]]), roles: new Map(), newRoles: new Map() }),
      (err) => err instanceof CommitError && err.code === "INVALID_CART"
    );
  }

  for (const delta of [0, -1, 1.5, Number.NaN]) {
    await rejects(
      commitCart(actor, { skills: new Map(), roles: new Map([["role-1", delta]]), newRoles: new Map() }),
      (err) => err instanceof CommitError && err.code === "INVALID_CART"
    );
  }

  for (const plannedRank of [0, -1, 1.5, Number.NaN]) {
    await rejects(
      commitCart(actor, {
        skills: new Map(),
        roles: new Map(),
        newRoles: new Map([["new:cyberpunk-red-core.core_roles:solo", {
          packId: "cyberpunk-red-core.core_roles",
          sourceId: "solo",
          name: "Solo",
          plannedRank,
        }]]),
      }),
      (err) => err instanceof CommitError && err.code === "INVALID_CART"
    );
  }
});

test("commitCart rejects new roles from unexpected packs", async () => {
  installGame({ fetchedRole: { name: "Solo" } });
  const actor = makeActor();

  await rejects(
    commitCart(actor, {
      skills: new Map(),
      roles: new Map(),
      newRoles: new Map([["new:other.pack:solo", {
        packId: "other.pack",
        sourceId: "solo",
        name: "Solo",
        plannedRank: 1,
      }]]),
    }),
    (err) => err instanceof CommitError && err.code === "INVALID_ROLE_SOURCE"
  );
});

test("fetchRoleItemData rejects unexpected role packs", async () => {
  installGame({ fetchedRole: { name: "Solo" } });

  await rejects(
    fetchRoleItemData("other.pack", "solo"),
    /Unexpected role pack/
  );
});

test("commitCart rejects fetched new-role payloads that are not roles", async () => {
  installGame({ fetchedRole: { name: "Solo", type: "weapon" } });
  const actor = makeActor();

  await rejects(
    commitCart(actor, {
      skills: new Map(),
      roles: new Map(),
      newRoles: new Map([["new:cyberpunk-red-core.core_roles:solo", {
        packId: "cyberpunk-red-core.core_roles",
        sourceId: "solo",
        name: "Solo",
        plannedRank: 1,
      }]]),
    }),
    (err) => err instanceof CommitError && err.code === "INVALID_ROLE_SOURCE"
  );
});

test("commitCart blocks duplicate new-role purchase by source id or name", async () => {
  installGame({ fetchedRole: { name: "Solo" } });
  const cart = {
    skills: new Map(),
    roles: new Map(),
    newRoles: new Map([["new:cyberpunk-red-core.core_roles:solo", {
      packId: "cyberpunk-red-core.core_roles",
      sourceId: "solo",
      name: "Solo",
      plannedRank: 1,
    }]]),
  };

  await rejects(
    commitCart(makeActor({ roleItem: makeRoleItem({
      id: "role-1",
      name: "Different Name",
      sourceId: "Compendium.cyberpunk-red-core.core_roles.solo",
    }) }), cart),
    (err) => err instanceof CommitError && err.code === "DUPLICATE_ROLE"
  );

  await rejects(
    commitCart(makeActor({ roleItem: makeRoleItem({ id: "role-1", name: "Solo" }) }), cart),
    (err) => err instanceof CommitError && err.code === "DUPLICATE_ROLE"
  );
});

test("commitCart creates a new role at planned rank and charges each rank", async () => {
  installGame({ fetchedRole: { name: "Solo" } });
  const actor = makeActor();

  const result = await commitCart(actor, {
    skills: new Map(),
    roles: new Map(),
    newRoles: new Map([["new:cyberpunk-red-core.core_roles:solo", {
      packId: "cyberpunk-red-core.core_roles",
      sourceId: "solo",
      name: "Solo",
      plannedRank: 3,
    }]]),
  });

  strictEqual(actor.created[0].type, "Item");
  strictEqual(actor.created[0].docs[0].system.rank, 3);
  strictEqual(actor.system.improvementPoints.transactions.length, 3);
  strictEqual(result.count, 3);
  strictEqual(result.totalCost, 360);
});

test("commitCart rejects duplicate new-role entries within the same cart", async () => {
  installGame({ fetchedRole: { name: "Solo" } });

  await rejects(
    commitCart(makeActor(), {
      skills: new Map(),
      roles: new Map(),
      newRoles: new Map([
        ["new:cyberpunk-red-core.core_roles:solo:a", {
          packId: "cyberpunk-red-core.core_roles",
          sourceId: "solo",
          name: "Solo",
          plannedRank: 1,
        }],
        ["new:cyberpunk-red-core.core_roles:solo:b", {
          packId: "cyberpunk-red-core.core_roles",
          sourceId: "solo",
          name: "Solo Variant",
          plannedRank: 1,
        }],
      ]),
    }),
    (err) => err instanceof CommitError && err.code === "DUPLICATE_ROLE"
  );

  await rejects(
    commitCart(makeActor(), {
      skills: new Map(),
      roles: new Map(),
      newRoles: new Map([
        ["new:cyberpunk-red-core.core_roles:solo", {
          packId: "cyberpunk-red-core.core_roles",
          sourceId: "solo",
          name: "Solo",
          plannedRank: 1,
        }],
        ["new:cyberpunk-red-core.core_roles:solo-alt", {
          packId: "cyberpunk-red-core.core_roles",
          sourceId: "solo-alt",
          name: "Solo",
          plannedRank: 1,
        }],
      ]),
    }),
    (err) => err instanceof CommitError && err.code === "DUPLICATE_ROLE"
  );
});

test("commitCart rejects new role when fetched name matches actor role despite stale cart name", async () => {
  installGame({ fetchedRole: { name: "Solo" } });
  const actor = makeActor({ roleItem: makeRoleItem({ id: "role-1", name: "Solo" }) });

  await rejects(
    commitCart(actor, {
      skills: new Map(),
      roles: new Map(),
      newRoles: new Map([["new:cyberpunk-red-core.core_roles:solo", {
        packId: "cyberpunk-red-core.core_roles",
        sourceId: "solo",
        name: "Not Solo",
        plannedRank: 1,
      }]]),
    }),
    (err) => err instanceof CommitError && err.code === "DUPLICATE_ROLE"
  );
});

test("commitCart does not reject valid fetched role because stale cart name matches actor role", async () => {
  installGame({ fetchedRole: { name: "Netrunner" } });
  const actor = makeActor({ roleItem: makeRoleItem({ id: "role-1", name: "Solo" }) });

  await commitCart(actor, {
    skills: new Map(),
    roles: new Map(),
    newRoles: new Map([["new:cyberpunk-red-core.core_roles:netrunner", {
      packId: "cyberpunk-red-core.core_roles",
      sourceId: "netrunner",
      name: "Solo",
      plannedRank: 1,
    }]]),
  });

  strictEqual(actor.created[0].docs[0].name, "Netrunner");
});

test("commitCart ledger entries chain IP correctly across multi-level purchases", async () => {
  installGame();

  const actor = makeActor({
    items: [
      makeSkillItem({ id: "skill-1", name: "Athletics", level: 2, difficulty: "typical" }),
      makeSkillItem({ id: "skill-2", name: "Concentration", level: 0, difficulty: "typical" }),
    ],
    ip: 500,
  });

  // Athletics 2→3 costs 60, 3→4 costs 80; Concentration 0→1 costs 20. Total = 160.
  await commitCart(actor, {
    skills: new Map([["skill-1", 2], ["skill-2", 1]]),
    roles: new Map(),
    newRoles: new Map(),
  });

  const txs = actor.system.improvementPoints.transactions;
  strictEqual(txs.length, 3);
  strictEqual(actor.system.improvementPoints.value, 340);

  const prefix = "CPR.ledger.decreaseSentence:";
  const totals = txs.map(([sentence]) => JSON.parse(sentence.slice(prefix.length)).total);
  deepStrictEqual(totals, [440, 360, 340]);
});

test("commitCart uses fetched role name in new-role ledger reason", async () => {
  installGame({ fetchedRole: { name: "Netrunner" } });
  const actor = makeActor();

  await commitCart(actor, {
    skills: new Map(),
    roles: new Map(),
    newRoles: new Map([["new:cyberpunk-red-core.core_roles:netrunner", {
      packId: "cyberpunk-red-core.core_roles",
      sourceId: "netrunner",
      name: "Wrong Name",
      plannedRank: 1,
    }]]),
  });

  strictEqual(actor.system.improvementPoints.transactions[0][1].includes("Netrunner"), true);
  strictEqual(actor.system.improvementPoints.transactions[0][1].includes("Wrong Name"), false);
});
