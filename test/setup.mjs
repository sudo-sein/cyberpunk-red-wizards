// Preloaded via `node --test --import ./test/setup.mjs`. Installs the Foundry
// runtime globals the parser expects, before any parser module is imported:
//  - foundry.utils.randomID(): deterministic id for template.id.
//  - fetch(): fs-backed; maps "modules/cyberpunk-red-wizards/<...>" onto disk so
//    statblock-parser.js can load data/import-maps/<lang>.json without a server.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

globalThis.foundry = { utils: { randomID: () => "TESTID" } };
globalThis.foundry.applications = { api: { DialogV2: class {}, ApplicationV2: class {}, HandlebarsApplicationMixin: (c) => c } };

globalThis.fetch = async (p) => {
  const rel = String(p).replace(/^modules\/cyberpunk-red-wizards\//, "");
  const abs = resolve(moduleRoot, rel);
  return {
    ok: existsSync(abs),
    async json() { return JSON.parse(readFileSync(abs, "utf8")); },
  };
};
