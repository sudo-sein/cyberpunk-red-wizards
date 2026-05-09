// =============================================================================
// Mook actor findings (from cyberpunk-red-core system inspection):
// =============================================================================
//
// CPRActor.create() (cpr-actor.js, line 33):
//   - Checks `typeof data.system === "undefined"` to decide if this is a new actor.
//   - If data.system IS defined (even partially), skips auto-population and calls
//     super.create() directly — same pitfall as characters.
//   - When system is undefined (fresh actor), auto-populates: core skills (from
//     internal_skills pack) and core cyberware (from internal_cyberware pack).
//
// CPRMookActor.create() (cpr-mook.js, line 21):
//   - Overrides CPRActor.create() to set prototypeToken defaults (bar1=hp, no actorLink).
//   - Calls super.create() (CPRActor.create()) for the actual item auto-population.
//   - BUG: Missing `return` keyword on the super.create() call (line 30). The promise
//     is awaited by the parent but not returned to the caller. This means
//     getDocumentClass("Actor").create({ type: "mook", ... }) resolves to `undefined`.
//   - Workaround: use CPRActor.create() directly, OR call the base Foundry
//     Actor.create() which goes through the entity-factory Proxy and routes to
//     CPRMookActor.create(). Test at runtime whether the return is actually undefined.
//
// Mook stats — SAME path as characters (both use CommonSchema):
//   - system.stats.int.value, system.stats.ref.value, system.stats.dex.value
//   - system.stats.tech.value, system.stats.cool.value, system.stats.will.value
//   - system.stats.luck.value / system.stats.luck.max
//   - system.stats.move.value, system.stats.body.value
//   - system.stats.emp.value / system.stats.emp.max
//   Stat values default to 6. Update via actor.update({ "system.stats.body.value": N }).
//
// Mook skills — stored as EMBEDDED ITEMS (type "skill"), NOT flat fields:
//   - Same as characters: auto-populated by CPRActor.create() from the internal_skills pack.
//   - Read via actor.itemTypes.skill (array of Item documents).
//   - Computed accessor actor.system.skills returns a flat object keyed by slugified name:
//       { "athletics": { level, stat, mods }, ... }
//   - To update a skill level: find the item by name and call item.update({ "system.level": N }).
//   - Core skills (system.core === true) cannot be added via createEmbeddedDocuments().
//     They are auto-populated on create — do NOT pass data.system in the create() call.
//
// Mook HP:
//   - Stored at system.derivedStats.hp.max and system.derivedStats.hp.value.
//   - HP max is NOT auto-calculated on create — it defaults to 40 (from HpSchema initial).
//   - The formula (from CPRActor.calcMaxHp()) is:
//       maxHp = 10 + 5 * Math.ceil((WILL + BODY) / 2)
//   - Must be calculated and set manually after setting stats:
//       const maxHp = actor.calcMaxHp();
//       await actor.update({
//         "system.derivedStats.hp.max": maxHp,
//         "system.derivedStats.hp.value": maxHp,
//       });
//
// Mook vs Character differences:
//   - Both use CommonSchema: identical stat/skill/HP paths.
//   - MookDataModel is simpler — no lifepath, lifestyle, or wealth fields.
//   - Mook token defaults: no actorLink, neutral disposition, sight enabled.
//   - Character token defaults: actorLink=true, friendly disposition.
//
// Recommendation:
//   - Use the SAME flow as characters for mooks:
//       1. getDocumentClass("Actor").create({ name, type: "mook" }) — no system field.
//       2. After creation, actor.update() for stats and hp.
//       3. createEmbeddedDocuments() for non-core items (weapons, armor, role, etc.).
//   - Watch for the missing-return bug in CPRMookActor.create(). At runtime, if the
//     returned actor is undefined, fall back to finding the actor by name in game.actors
//     or patch the call chain.
//   - No branching logic needed for mook vs character in the factory for skills/stats/HP —
//     the data model paths are identical.
//
// =============================================================================

/**
 * NPC Factory — creates Foundry Actors for the NPC generator.
 *
 * Stub — full implementation in Task 3.
 */
export class NPCFactory {
  // Implementation coming in Task 3.
}
