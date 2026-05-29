const IMPROVEMENT_PRESENCE_HANDLER = "improvementPresence";
export const IMPROVEMENT_PRESENCE_HOOK = "crwImprovementPresence";

let presenceSocket = null;

export function initImprovementPresence(socket) {
  presenceSocket = socket ?? null;
  if (!presenceSocket?.register) return;

  presenceSocket.register(IMPROVEMENT_PRESENCE_HANDLER, onImprovementPresence);
}

export function announceImprovementOpen(actorId) {
  announceImprovementPresence(actorId, "open");
}

export function announceImprovementClose(actorId) {
  announceImprovementPresence(actorId, "close");
}

function announceImprovementPresence(actorId, state) {
  if (!actorId || !presenceSocket?.executeForOthers) return;

  presenceSocket.executeForOthers(IMPROVEMENT_PRESENCE_HANDLER, {
    actorId,
    userId: globalThis.game?.user?.id,
    state,
  });
}

function onImprovementPresence(payload) {
  const normalizedPayload = normalizePresencePayload(payload);
  if (!normalizedPayload) return;

  globalThis.Hooks?.callAll(IMPROVEMENT_PRESENCE_HOOK, normalizedPayload);
}

function normalizePresencePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const { actorId, userId, state } = payload;
  if (typeof actorId !== "string" || actorId.length === 0) return null;
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (state !== "open" && state !== "close") return null;

  return { actorId, userId, state };
}
