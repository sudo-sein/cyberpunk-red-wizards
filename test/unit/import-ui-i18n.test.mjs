import { test } from "node:test";
import { ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KEYS = ["crw.import.confidence", "crw.import.parsedSections", "crw.import.missing"];

for (const lang of ["en", "pl"]) {
  test(`${lang}.json defines the confidence i18n keys`, () => {
    const json = JSON.parse(readFileSync(resolve(root, "languages", `${lang}.json`), "utf8"));
    for (const k of KEYS) ok(json[k] !== undefined, `missing ${k}`);
  });
}

test("import template renders the confidence summary", () => {
  const hbs = readFileSync(resolve(root, "templates", "statblock-import.hbs"), "utf8");
  ok(hbs.includes("diagnosticsSummary"), "template references diagnosticsSummary");
  ok(hbs.includes("crw.import.parsedSections"), "template localizes parsedSections");
});
