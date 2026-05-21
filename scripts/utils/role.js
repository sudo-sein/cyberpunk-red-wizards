// Adds a role item to an actor without tripping the system's
// update-role-from-item createItem hook on non-owner clients.
//
// That hook (cyberpunk-red-core/modules/hooks/actor/update-role-from-item.js)
// fires on EVERY connected client when a role item is created and calls
// actor.update() with no GM/owner guard. During GM-side actor creation this
// throws "User <name> lacks permission to update Actor" on every player's
// client. We pre-set activeRole/activeNetRole (to the role's pre-generated id)
// so both of the hook's conditions are already satisfied — making it a no-op
// everywhere — and the role still ends up assigned exactly as the hook intends.
export async function addRoleItem(actor, roleItemData) {
  roleItemData._id = foundry.utils.randomID();
  await actor.update({
    "system.roleInfo.activeRole": roleItemData.name,
    "system.roleInfo.activeNetRole": roleItemData._id,
  });
  await actor.createEmbeddedDocuments("Item", [roleItemData], { keepId: true });
}
