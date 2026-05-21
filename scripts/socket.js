// scripts/socket.js
// Owns the single socketlib instance for this module. Feature modules
// (store, creator) register their handlers against getSocket() in the
// "ready" hook after initSharedSocket() has run.
import { MODULE_ID } from "./constants.js";

let socket = null;

export function initSharedSocket() {
  socket = socketlib.registerModule(MODULE_ID);
  return socket;
}

export function getSocket() {
  return socket;
}
