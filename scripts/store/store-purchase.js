export function calculateFinalPrice(basePrice, markup) {
  return Math.ceil(basePrice * (markup / 100));
}

export async function purchaseItem(actor, itemEntry, markup) {
  const finalCost = calculateFinalPrice(itemEntry.price, markup);
  const balance = actor.system.wealth.value;
  const canAfford = balance >= finalCost || finalCost === 0;

  const balanceFormatted = balance.toLocaleString();
  const costFormatted = finalCost.toLocaleString();
  const remainingFormatted = (balance - finalCost).toLocaleString();

  const content = `
    <p>${game.i18n.format("crw.store.confirm.body", { name: `<strong>${itemEntry.name}</strong>`, cost: costFormatted })}</p>
    <p>${game.i18n.format("crw.store.confirm.balance", { balance: balanceFormatted })}</p>
    <p>${game.i18n.format("crw.store.confirm.afterPurchase", { remaining: remainingFormatted })}</p>
    ${!canAfford ? `<p style="color: var(--cpr-color-red); font-weight: bold;">${game.i18n.localize("crw.store.confirm.insufficientFunds")}</p>` : ""}
  `;

  const { DialogV2 } = foundry.applications.api;
  const confirmed = await DialogV2.confirm({
    window: { title: game.i18n.localize("crw.store.confirm.title") },
    content,
    yes: { disabled: !canAfford },
    rejectClose: false,
  });

  if (!confirmed) return false;

  const doc = await fromUuid(itemEntry.uuid);
  if (!doc) {
    ui.notifications.error(`Item not found: ${itemEntry.name}`);
    return false;
  }

  if (finalCost > 0) {
    await actor.deltaLedgerProperty(
      "wealth",
      -finalCost,
      game.i18n.format("crw.store.purchased", { name: itemEntry.name })
    );
  }

  const itemData = doc.toObject();
  await actor.createEmbeddedDocuments("Item", [itemData]);

  ui.notifications.info(game.i18n.format("crw.store.purchased", { name: itemEntry.name }));
  return true;
}

export async function lootItem(actor, itemEntry) {
  const doc = await fromUuid(itemEntry.uuid);
  if (!doc) {
    ui.notifications.error(`Item not found: ${itemEntry.name}`);
    return false;
  }

  const itemData = doc.toObject();
  await actor.createEmbeddedDocuments("Item", [itemData]);

  ui.notifications.info(game.i18n.format("crw.store.looted", { name: itemEntry.name }));
  return true;
}
