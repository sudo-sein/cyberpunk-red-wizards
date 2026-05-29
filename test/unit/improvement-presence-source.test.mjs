import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { afterEach } from "node:test";
import {
  announceImprovementClose,
  announceImprovementOpen,
  initImprovementPresence,
} from "../../scripts/improvement/improvement-presence.js";

const presenceSource = await readFile(new URL("../../scripts/improvement/improvement-presence.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../../scripts/main.js", import.meta.url), "utf8");

afterEach(() => {
  delete globalThis.game;
  delete globalThis.Hooks;
  initImprovementPresence(null);
});

function createFakeSocket() {
  const registrations = [];
  const executions = [];

  return {
    registrations,
    executions,
    register(handlerName, handler) {
      registrations.push({ handlerName, handler });
    },
    executeForOthers(handlerName, payload) {
      executions.push({ handlerName, payload });
    },
  };
}

test("improvement presence exports initialization and announce functions", () => {
  assert.match(presenceSource, /export function initImprovementPresence\(socket\)/);
  assert.match(presenceSource, /export function announceImprovementOpen\(actorId\)/);
  assert.match(presenceSource, /export function announceImprovementClose\(actorId\)/);
});

test("improvement presence broadcasts advisory updates to other clients only", () => {
  assert.match(presenceSource, /executeForOthers\(/);
  assert.doesNotMatch(presenceSource, /executeAsGM/);
});

test("improvement presence registers a clear handler and emits a Foundry hook", () => {
  assert.match(presenceSource, /improvementPresence/);
  assert.match(presenceSource, /register\(.*IMPROVEMENT_PRESENCE_HANDLER/);
  assert.match(presenceSource, /crwImprovementPresence/);
  assert.match(presenceSource, /Hooks\?\.callAll\(IMPROVEMENT_PRESENCE_HOOK/);
});

test("main initializes improvement presence after the shared socket is available", () => {
  assert.match(mainSource, /import \{ initImprovementPresence \} from "\.\/improvement\/improvement-presence\.js";/);
  assert.match(mainSource, /const socket = initSharedSocket\(\);/);
  assert.match(mainSource, /initImprovementPresence\(socket\);/);
});

test("initImprovementPresence registers the improvementPresence socket handler", () => {
  const socket = createFakeSocket();

  initImprovementPresence(socket);

  assert.equal(socket.registrations.length, 1);
  assert.equal(socket.registrations[0].handlerName, "improvementPresence");
  assert.equal(typeof socket.registrations[0].handler, "function");
});

test("announceImprovementOpen sends an open presence payload", () => {
  globalThis.game = { user: { id: "user-1" } };
  const socket = createFakeSocket();
  initImprovementPresence(socket);

  announceImprovementOpen("actor-1");

  assert.deepEqual(socket.executions, [
    {
      handlerName: "improvementPresence",
      payload: { actorId: "actor-1", userId: "user-1", state: "open" },
    },
  ]);
});

test("announceImprovementClose sends a close presence payload", () => {
  globalThis.game = { user: { id: "user-1" } };
  const socket = createFakeSocket();
  initImprovementPresence(socket);

  announceImprovementClose("actor-1");

  assert.deepEqual(socket.executions, [
    {
      handlerName: "improvementPresence",
      payload: { actorId: "actor-1", userId: "user-1", state: "close" },
    },
  ]);
});

test("presence announcers no-op when actorId is absent", () => {
  globalThis.game = { user: { id: "user-1" } };
  const socket = createFakeSocket();
  initImprovementPresence(socket);

  announceImprovementOpen("");
  announceImprovementClose(null);

  assert.deepEqual(socket.executions, []);
});

test("receiver emits crwImprovementPresence with normalized payload", () => {
  const hookCalls = [];
  globalThis.Hooks = {
    callAll(hookName, payload) {
      hookCalls.push({ hookName, payload });
    },
  };
  const socket = createFakeSocket();
  initImprovementPresence(socket);

  socket.registrations[0].handler({ actorId: "actor-1", userId: "user-1", state: "open", extra: "ignored" });

  assert.deepEqual(hookCalls, [
    {
      hookName: "crwImprovementPresence",
      payload: { actorId: "actor-1", userId: "user-1", state: "open" },
    },
  ]);
});

test("receiver ignores invalid presence payloads", () => {
  const hookCalls = [];
  globalThis.Hooks = {
    callAll(hookName, payload) {
      hookCalls.push({ hookName, payload });
    },
  };
  const socket = createFakeSocket();
  initImprovementPresence(socket);

  for (const payload of [
    null,
    undefined,
    "invalid",
    [],
    { actorId: "", userId: "user-1", state: "open" },
    { actorId: "actor-1", userId: "", state: "open" },
    { actorId: "actor-1", userId: "user-1", state: "opening" },
  ]) {
    socket.registrations[0].handler(payload);
  }

  assert.deepEqual(hookCalls, []);
});
