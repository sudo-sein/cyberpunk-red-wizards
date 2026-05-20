// Fixture-driven end-to-end parser test. For every <name>.json under a fixture
// dir's expected/, parse the matching strings/<name>.txt through the real
// parser and assert there are no field diffs and no parser errors.
//
// Uses a ONE-DIRECTIONAL diff (walks only keys present in expected, ignoring
// extra keys on the actual template) so ground-truth fixtures may omit
// defaulted/empty fields like weaponAlternatives / armor.alternatives.
//
// Two dirs are scanned: test/fixtures (committed synthetic) and
// test/fixtures-local (gitignored real corpus). A missing dir registers no
// cases, so CI with no local corpus still passes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const moduleRoot = resolve(__dirname, "..");

const { parseStatblock } = await import(
  pathToFileURL(join(moduleRoot, "scripts", "import", "statblock-parser.js")).href
);

const IGNORE = new Set(["id", "name", "nameKey", "source", "language"]);

function diffValue(path, exp, act, out) {
  if (Array.isArray(exp)) {
    if (!Array.isArray(act)) { out.push({ path, exp, act }); return; }
    if (exp.length !== act.length) out.push({ path: `${path}.length`, exp: exp.length, act: act.length });
    for (let i = 0; i < Math.max(exp.length, act.length); i++) {
      diffValue(`${path}[${i}]`, exp[i], act[i], out);
    }
  } else if (exp && typeof exp === "object") {
    if (!act || typeof act !== "object") { out.push({ path, exp, act }); return; }
    for (const k of Object.keys(exp)) diffValue(`${path}.${k}`, exp[k], act[k], out);
  } else if (JSON.stringify(exp) !== JSON.stringify(act)) {
    out.push({ path, exp, act });
  }
}

function diffTemplate(expected, actual) {
  const out = [];
  for (const key of Object.keys(expected)) {
    if (IGNORE.has(key)) continue;
    diffValue(key, expected[key], actual[key], out);
  }
  return out;
}

function registerFixtureDir(label, dir) {
  const expectedDir = join(dir, "expected");
  if (!existsSync(expectedDir)) return;
  const names = readdirSync(expectedDir)
    .filter(f => f.endsWith(".json"))
    .map(f => basename(f, ".json"))
    .sort();
  for (const name of names) {
    const txtPath = join(dir, "strings", `${name}.txt`);
    test(`${label}/${name}`, async (t) => {
      if (!existsSync(txtPath)) { t.skip(`no strings/${name}.txt`); return; }
      const expected = JSON.parse(readFileSync(join(expectedDir, `${name}.json`), "utf8"));
      const text = readFileSync(txtPath, "utf8");
      const { template, errors } = await parseStatblock(text, expected.language || "en");
      assert.deepEqual(errors, [], `parser errors: ${JSON.stringify(errors)}`);
      const diffs = diffTemplate(expected, template);
      assert.equal(
        diffs.length, 0,
        "field diffs:\n" + diffs.map(d => `  ${d.path}: expected ${JSON.stringify(d.exp)} got ${JSON.stringify(d.act)}`).join("\n"),
      );
    });
  }
}

registerFixtureDir("fixtures", join(moduleRoot, "test", "fixtures"));
registerFixtureDir("fixtures-local", join(moduleRoot, "test", "fixtures-local"));
