// scripts/store/store-socket.js
import { MODULE_ID } from "../constants.js";
import { getSocket } from "../socket.js";
import StoreApp from "../app/store-app.js";

export function initStoreSocket() {
  const socket = getSocket();
  socket.register("updateStoreState", onStoreStateReceived);
}

export function broadcastStoreState() {
  const socket = getSocket();
  if (!game.user.isGM || !socket) return;
  const markup = game.settings.get(MODULE_ID, "storeMarkup");
  const availability = game.settings.get(MODULE_ID, "storeAvailability");
  socket.executeForOthers("updateStoreState", { markup, availability });
}

function onStoreStateReceived() {
  StoreApp.refresh();
}
