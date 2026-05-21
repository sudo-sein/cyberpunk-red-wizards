const MODULE_PATH = "modules/cyberpunk-red-wizards";

const roleCache = new Map();

export async function loadRole(roleId) {
  if (roleCache.has(roleId)) return roleCache.get(roleId);

  const path = `${MODULE_PATH}/data/roles/${roleId}.json`;
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load role data: ${path}`);
  const data = await response.json();
  roleCache.set(roleId, data);
  return data;
}

export function clearRoleCache() {
  roleCache.clear();
}
