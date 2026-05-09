const MODULE_ID = "cyberpunk-red-wizards";

let socket = null;

export function initSocket() {
  socket = socketlib.registerModule(MODULE_ID);
  socket.register("updateStoreState", onStoreStateReceived);
}

export function getSocket() {
  return socket;
}

export function broadcastStoreState() {
  if (!game.user.isGM || !socket) return;
  const markup = game.settings.get(MODULE_ID, "storeMarkup");
  const availability = game.settings.get(MODULE_ID, "storeAvailability");
  socket.executeForOthers("updateStoreState", { markup, availability });
}

function onStoreStateReceived({ markup, availability }) {
  const app = Object.values(ui.windows).find(w => w.id === "crw-store");
  if (app) app.render(true);
}
