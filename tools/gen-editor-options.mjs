// tools/gen-editor-options.mjs
// Reads the CPR core LevelDB packs directly and writes data/editor-options.json.
// Usage: node tools/gen-editor-options.mjs [packsPath]
//   packsPath defaults to ../../systems/cyberpunk-red-core/packs (Foundry-relative),
//   overridable by argv[2] or the CPR_PACKS env var.
import { ClassicLevel } from "classic-level";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildCatalog } from "./build-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = resolve(__dirname, "..");
const DEFAULT_PACKS = resolve(MODULE_ROOT, "../../systems/cyberpunk-red-core/packs");
const PACKS_PATH = process.argv[2] ?? process.env.CPR_PACKS ?? DEFAULT_PACKS;

const CORE_PACKS = ["weapons", "armor", "cyberware", "gear", "drugs", "ammo"];

async function extractPack(packName) {
  const dbPath = `${PACKS_PATH}/core/${packName}`;
  const db = new ClassicLevel(dbPath, { valueEncoding: "utf8", createIfMissing: false });
  await db.open();
  const byName = new Map();
  for await (const [, value] of db.iterator()) {
    try {
      const data = JSON.parse(value);
      if (!data.name || !data._id) continue;
      const entry = { name: data.name, type: data.type };
      if (data.system?.damage !== undefined) entry.damage = data.system.damage;
      if (data.system?.headLocation?.sp !== undefined) entry.headSp = data.system.headLocation.sp;
      if (data.system?.bodyLocation?.sp !== undefined) entry.bodySp = data.system.bodyLocation.sp;
      const prev = byName.get(data.name);
      if (!prev || Object.keys(entry).length > Object.keys(prev).length) byName.set(data.name, entry);
    } catch {
      /* skip malformed rows */
    }
  }
  await db.close();
  return [...byName.values()];
}

async function main() {
  const packs = {};
  for (const p of CORE_PACKS) packs[`core/${p}`] = await extractPack(p);
  const catalog = buildCatalog(packs);
  const outPath = resolve(MODULE_ROOT, "data/editor-options.json");
  await writeFile(outPath, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);
  for (const [k, v] of Object.entries(catalog)) console.log(`  ${k}: ${v.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
