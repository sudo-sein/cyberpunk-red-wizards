import { skillCost, roleCost } from "./ip-costs.js";
import { fetchRoleItemData } from "./compendium-roles.js";

const MAX_LEVEL = 10;
const COMMIT_LOCKS = new WeakSet();

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
      if (delta <= 0) continue;
      const item = actor.items.get(id);
      if (!item) {
        warnings.push({ code: "ITEM_MISSING", name: game.i18n.localize("crw.improvement.labels.skill") });
        continue;
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
      if (delta <= 0) continue;
      const item = actor.items.get(id);
      if (!item) {
        warnings.push({ code: "ITEM_MISSING", name: game.i18n.localize("crw.improvement.labels.role") });
        continue;
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
    for (const [, entry] of cart.newRoles) {
      if (entry.plannedRank <= 0) continue;
      if (entry.plannedRank > MAX_LEVEL) {
        throw new CommitError("CAP_EXCEEDED", { name: entry.name });
      }
      const payload = await fetchRoleItemData(entry.packId, entry.sourceId);
      payload.system = payload.system || {};
      payload.system.rank = entry.plannedRank;
      newRoleCreates.push(payload);

      const purchaseCost = roleCost(1);
      totalCost += purchaseCost;
      ledgerEntries.push({
        amount: -purchaseCost,
        reason: game.i18n.format("crw.improvement.ledger.newRole", {
          name: entry.name,
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
            name: entry.name,
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
    for (const entry of ledgerEntries) {
      actor.deltaLedgerProperty("improvementPoints", entry.amount, entry.reason);
    }

    return { totalCost, count, warnings };
  } finally {
    COMMIT_LOCKS.delete(actor);
  }
}
