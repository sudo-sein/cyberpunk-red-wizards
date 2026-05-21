import { getSocket } from "../socket.js";
import StepSummary from "../steps/step-summary.js";

export const NO_ACTIVE_GM = "No active GM";

export function initCreatorSocket() {
  const socket = getSocket();
  socket.register("createCharacterForPlayer", handleCreateCharacterForPlayer);
}

export async function requestCharacterCreation(state) {
  const socket = getSocket();
  return socket.executeAsGM("createCharacterForPlayer", { state, userId: game.userId });
}

async function handleCreateCharacterForPlayer({ state, userId }) {
  const user = game.users.get(userId);
  if (!user) throw new Error("Unknown user");
  if (user.character) {
    throw new Error(game.i18n.localize("crw.creator.alreadyHasCharacter"));
  }

  const step = new StepSummary();
  const actor = await step.createCharacter(state);

  await actor.update({
    ownership: { [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
  });

  await user.update({ character: actor.id });

  return actor.uuid;
}
