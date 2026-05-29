import { skillCost, roleCost } from "./ip-costs.js";
import { ROLE_PACK_ID, fetchRoleItemData } from "./compendium-roles.js";

const MAX_LEVEL = 10;
const COMMIT_LOCKS = new WeakSet();

function assertPositiveSafeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CommitError("INVALID_CART", { field });
  }
}

function sourceUuid(packId, sourceId) {
  return `Compendium.${packId}.${sourceId}`;
}

function actorHasRole(actor, { packId, sourceId, name }) {
  const uuid = sourceUuid(packId, sourceId);
  const items = actor.items?.values ? actor.items.values() : actor.items ?? [];

  for (const item of items) {
    if (item.type !== "role") continue;
    if (item.getFlag?.("core", "sourceId") === uuid) return true;
    if (item.name === name) return true;
  }

  return false;
}

export class CommitError extends Error {
  constructor(code, data = {}) {
    super(code);
    this.code = code;
    this.data = data;
  }
}

/**
 * Re-evaluates the cart against the current actor state, then applies it:
 *   1. createEmbeddedDocuments for new roles (with their planned rank)
 *   2. updateEmbeddedDocuments for existing skills + roles
 *   3. deltaLedgerProperty per atomic +1 increment (and per new-role purchase)
 * Throws CommitError on validation failure. Notifications are the caller's job.
 *
 * @param {Actor} actor
 * @param {{ skills: Map, roles: Map, newRoles: Map }} cart
 * @returns {Promise<{ totalCost: number, count: number, warnings: Array<{code: string, name: string}> }>}
 */
export async function commitCart(actor, cart) {
  if (COMMIT_LOCKS.has(actor)) {
    throw new CommitError("COMMIT_IN_PROGRESS");
  }
  COMMIT_LOCKS.add(actor);

  try {
    const skillUpdates = [];
    const roleUpdates = [];
    const ledgerEntries = []; // [{ amount, reason }]
    let totalCost = 0;
    let count = 0;
    const warnings = []; // missing items, etc. — returned for caller to notify

    // ── Existing skills ──
    for (const [id, delta] of cart.skills) {
      assertPositiveSafeInteger(delta, "skill.delta");
      const item = actor.items.get(id);
      if (!item) {
        warnings.push({ code: "ITEM_MISSING", name: game.i18n.localize("crw.improvement.labels.skill") });
        continue;
      }
      if (item.type !== "skill") {
        throw new CommitError("INVALID_CART", { field: "skill.itemType", name: item.name });
      }
      const startLevel = item.system.level ?? 0;
      if (startLevel + delta > MAX_LEVEL) {
        throw new CommitError("CAP_EXCEEDED", { name: item.name });
      }
      skillUpdates.push({ _id: id, "system.level": startLevel + delta });
      for (let i = 1; i <= delta; i++) {
        const nextLevel = startLevel + i;
        const cost = skillCost(nextLevel, item.system.difficulty);
        totalCost += cost;
        ledgerEntries.push({
          amount: -cost,
          reason: game.i18n.format("crw.improvement.ledger.skill", {
            name: item.name,
            from: nextLevel - 1,
            to: nextLevel,
          }),
        });
        count++;
      }
    }

    // ── Existing roles ──
    for (const [id, delta] of cart.roles) {
      assertPositiveSafeInteger(delta, "role.delta");
      const item = actor.items.get(id);
      if (!item) {
        warnings.push({ code: "ITEM_MISSING", name: game.i18n.localize("crw.improvement.labels.role") });
        continue;
      }
      if (item.type !== "role") {
        throw new CommitError("INVALID_CART", { field: "role.itemType", name: item.name });
      }
      const startRank = item.system.rank ?? 0;
      if (startRank + delta > MAX_LEVEL) {
        throw new CommitError("CAP_EXCEEDED", { name: item.name });
      }
      roleUpdates.push({ _id: id, "system.rank": startRank + delta });
      for (let i = 1; i <= delta; i++) {
        const nextRank = startRank + i;
        const cost = roleCost(nextRank);
        totalCost += cost;
        ledgerEntries.push({
          amount: -cost,
          reason: game.i18n.format("crw.improvement.ledger.role", {
            name: item.name,
            from: nextRank - 1,
            to: nextRank,
          }),
        });
        count++;
      }
    }

    // ── New roles ──
    // Resolve compendium documents to creation payloads; cost the full ladder from 0.
    const newRoleCreates = [];
    const pendingNewRoleSources = new Set();
    const pendingNewRoleNames = new Set();
    for (const [, entry] of cart.newRoles) {
      assertPositiveSafeInteger(entry.plannedRank, "newRole.plannedRank");
      if (entry.plannedRank > MAX_LEVEL) {
        throw new CommitError("CAP_EXCEEDED", { name: entry.name });
      }
      if (entry.packId !== ROLE_PACK_ID) {
        throw new CommitError("INVALID_ROLE_SOURCE", { name: entry.name });
      }
      if (actorHasRole(actor, { packId: entry.packId, sourceId: entry.sourceId })) {
        throw new CommitError("DUPLICATE_ROLE", { name: entry.name });
      }
      const uuid = sourceUuid(entry.packId, entry.sourceId);
      if (pendingNewRoleSources.has(uuid)) {
        throw new CommitError("DUPLICATE_ROLE", { name: entry.name });
      }
      pendingNewRoleSources.add(uuid);
      let payload;
      try {
        payload = await fetchRoleItemData(entry.packId, entry.sourceId);
      } catch (err) {
        throw new CommitError("INVALID_ROLE_SOURCE", { name: entry.name, cause: err?.message ?? String(err) });
      }
      if (payload.type !== "role") {
        throw new CommitError("INVALID_ROLE_SOURCE", { name: entry.name });
      }
      if (actorHasRole(actor, { packId: entry.packId, sourceId: entry.sourceId, name: payload.name })) {
        throw new CommitError("DUPLICATE_ROLE", { name: payload.name });
      }
      if (pendingNewRoleNames.has(payload.name)) {
        throw new CommitError("DUPLICATE_ROLE", { name: payload.name });
      }
      pendingNewRoleNames.add(payload.name);
      payload.system = payload.system || {};
      payload.system.rank = entry.plannedRank;
      newRoleCreates.push(payload);

      const purchaseCost = roleCost(1);
      totalCost += purchaseCost;
      ledgerEntries.push({
        amount: -purchaseCost,
        reason: game.i18n.format("crw.improvement.ledger.newRole", {
          name: payload.name,
          rank: 1,
        }),
      });
      count++;
      for (let i = 2; i <= entry.plannedRank; i++) {
        const cost = roleCost(i);
        totalCost += cost;
        ledgerEntries.push({
          amount: -cost,
          reason: game.i18n.format("crw.improvement.ledger.role", {
            name: payload.name,
            from: i - 1,
            to: i,
          }),
        });
        count++;
      }
    }

    if (count === 0) throw new CommitError("EMPTY_CART");

    const currentIP = actor.system.improvementPoints?.value ?? 0;
    if (currentIP < totalCost) {
      throw new CommitError("INSUFFICIENT_IP", { value: currentIP, cost: totalCost });
    }

    // ── Apply ──
    if (newRoleCreates.length) {
      await actor.createEmbeddedDocuments("Item", newRoleCreates);
    }
    if (skillUpdates.length || roleUpdates.length) {
      await actor.updateEmbeddedDocuments("Item", [...skillUpdates, ...roleUpdates]);
    }
    // deltaLedgerProperty fires this.update() without await and returns no promise, so
    // calling it in a loop results in all entries reading the same stale in-memory IP.
    // Build all transactions manually and apply in a single update.
    {
      const prop = "improvementPoints";
      const valProp = `system.${prop}.value`;
      const txProp = `system.${prop}.transactions`;
      const existingTx = foundry.utils.getProperty(actor, txProp) ?? [];
      const newTx = [...existingTx];
      let runningIP = currentIP;
      for (const entry of ledgerEntries) {
        runningIP += entry.amount;
        newTx.push([
          game.i18n.format("CPR.ledger.decreaseSentence", {
            property: prop,
            amount: -entry.amount,
            total: runningIP,
          }),
          entry.reason,
        ]);
      }
      await actor.update({ [valProp]: runningIP, [txProp]: newTx });
    }

    return { totalCost, count, warnings };
  } finally {
    COMMIT_LOCKS.delete(actor);
  }
}
