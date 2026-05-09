import StoreApp from "../app/store-app.js";

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

function onStoreStateReceived() {
  StoreApp.refresh();
}
