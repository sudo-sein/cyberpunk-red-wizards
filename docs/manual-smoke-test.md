# Manual Smoke Test & Regression Checklist

Manual QA for **cyberpunk-red-wizards**. The unit suite (`pnpm test`) covers pure logic only; everything in this module's UI and actor/item creation runs against the live Foundry + cyberpunk-red-core APIs and **must be checked by hand in a running world**.

Run this checklist before merging UI/actor-creation changes, after a Foundry or cyberpunk-red-core version bump, or whenever a change touches the apps, steps, factory, store, or import pipeline.

## Preconditions

- Foundry VTT **v12** (build 12.343) running a world on the **cyberpunk-red-core** system (e.g. `night-city-2078`).
- Modules enabled: `cyberpunk-red-wizards`, `socketlib`.
- Logged in as a **GM**. For the multi-client store/creator checks, also have a second browser/client logged in as a **player** (a user with no assigned character).
- After editing module JS/CSS: reload the Foundry tab (**F5**). After editing `module.json` or i18n JSON: **restart** Foundry.
- Open the browser **dev console** (F12) and keep it visible — "no console errors" is part of nearly every expected result.

Legend: 🔁 = area touched by the maintainability-cleanup branch (highest regression risk). Run these first.

---

## 1. Entry points / buttons

**1.1 Sidebar buttons render**
1. Open the **Actors** sidebar tab.
2. As GM: confirm both **Character Creator** (user-plus icon) and **NPC Template** (users icon) buttons appear in the directory header.
3. Open the **Items** sidebar tab → confirm the **Store** button (store icon) appears.

Expected: all three buttons present, localized labels, no console error. As a player with no character, the Character Creator button appears; the NPC Template button does not (GM-only).

---

## 2. Character Creator 🔁

Covers shared constants, derived-stat formulas, GM-offline sentinel, compendium-miss warnings.

**2.1 Streetrat (template) flow**
1. Actors → **Character Creator**.
2. Step **Start**: pick a role (e.g. Solo), enter a handle.
3. Step through **Lifepath**, **Relationships** (add a friend, a love affair, an enemy with cause/revenge).
4. Step **Stats**: method should default per the *Default Method* client setting; for streetrat, pick a stat-template column (or roll 1d10 — a chat message should post).
5. **Derived**: confirm HP, Serious Wound, Humanity, Walk, Run display.
6. **Skills** (fixed), **Gear** (preset), **Summary**: the checklist shows all green; HP/derived match the Derived step.
7. Click **Create**.

Expected: actor created and its sheet opens. Core skills auto-populated, chosen skill levels applied, role ability present (rank 4), starting gear + cash present. HP and **Serious Wound** match `derived-stats` (Serious Wound = `ceil(HP/2)` — odd HP like 35 → **18**, not 17). No console errors.

**2.2 Edgerunner & Complete (point-buy) flows**
1. Re-open the creator, change method (via the default-method setting or in-flow) to **Edgerunner**, repeat. Then **Complete** (point-buy stats sum to 62, each 2–8; skills point-buy to 86).
2. Confirm the Summary checklist blocks **Create** until stats/skills/humanity/role/handle all pass.

Expected: point-buy validation enforces the caps; Complete uses the gear budget (2550 €$ default) instead of role starting cash.

**2.3 Player creation via GM (socket)** 🔁
1. On the **player** client (no character), open the creator and complete it → **Create**.
2. With a **GM connected**: the actor is created GM-side, ownership assigned to the player, and the player is notified ("assigned to …"); the sheet opens for them.
3. Now **disconnect all GMs** and have the player try again.

Expected: with a GM, creation succeeds and the player owns the actor. With no GM, the player gets the **"GM must be online"** warning (the `NO_ACTIVE_GM` path) — not a raw error. No duplicate actor.

**2.4 Compendium-miss warning** 🔁
- During any creation where an expected item can't be found in its pack, a **single** summary notification lists the skipped item names ("Some items were not found and were skipped: …"). A normal creation shows **no** such warning. (Hard to force deliberately — watch for false positives during 2.1/2.2.)

---

## 3. NPC Generator 🔁

**3.1 Browse & create from a built-in template**
1. Actors → **NPC Template**.
2. Confirm templates are grouped by category (e.g. Amateur → Nightmare Boss by default), searchable, and filterable by category. Templates with a removed category appear under **Uncategorized**.
3. Select a template → the detail pane shows stats, HP/SW/death save, armor, weapons, skills (top 8 + "show all"), equipment, cyberware, role.
4. Toggle **Mook/Character** actor type, optionally override the name and any gear "alternatives" dropdowns.
5. Click **Create**.

Expected: actor created and sheet opens **fully populated** — stats set, core skills present, armor/weapons equipped, cyberware installed, role ability at the listed rank. **No ~1s freeze and no half-populated sheet** (this is the readiness-poll path — see §6.2). No console errors.

**3.2 Save-as-custom / export / import / category config**
1. Select a built-in template → **Save as custom** → editor opens (see §4) → Save.
2. Confirm the custom copy appears (custom badge), is selectable, and **Create** works from it.
3. **Export** custom templates → a JSON file downloads.
4. **Import** that JSON in a fresh state → templates import; duplicate names get ` (2)` suffixes; already-present IDs are skipped; summary notification reports imported/skipped/renamed counts.
5. GM: open **Module Settings → NPC Categories → Configure Categories**. Add a new category, move it up/down, rename an existing one, remove one. Save. Confirm the generator groups update accordingly and any template whose category was removed falls under **Uncategorized**.

---

## 4. NPC Template Editor 🔁🔁 (highest-risk area)

This is the data-loss fix. Test it hard.

**4.1 Round-trip an exotic (non-preset) item**
1. Get a custom/imported template whose **cyberware or weapon is NOT in the editor's short dropdown lists** (e.g. import the statblock of a Militech veteran or any NPC with exotic chrome — see §5 — then Save as template).
2. NPC Template → select it → **Edit**.
3. On the **Combat** and **Extras** steps, confirm each exotic item shows **by its real name** in its dropdown (selected), **not** coerced to "Neural Link" / the first weapon / "None".
4. Click through steps and **Save without changing those items**.
5. Re-open **Edit**.

Expected: the exotic items **survive unchanged** — same name, and full data (weapon damage, armor SP, packName) intact. Before the fix these silently became the first preset.

**4.2 Mixed change + preserve**
1. In the editor, **change one** item to a preset option, leave an exotic one as-is, Save, re-open.

Expected: the changed item is the new preset; the untouched exotic item is preserved.

**4.3 Both armor slots exotic (label check)**
1. Edit a template whose **head and body** armor are both non-preset items.
2. On the Combat step, confirm the **head** dropdown's selected label is the head item and the **body** dropdown's selected label is the body item (independent labels — they should not both show the head's name).
3. Save → re-open → both armor slots preserved with correct SP.

**4.4 Stats / HP recalc**
1. Basics step: adjust stats with +/- (BODY caps at 20, others at 10).
2. Set BODY/WILL to an **odd-sum** pair (e.g. BODY 5, WILL 4) → click **Calc HP**.

Expected: HP = `10 + 5*ceil((BODY+WILL)/2)` and **Serious Wound = ceil(HP/2)** — both round **up**, matching the Character Creator for the same stats. (Regression guard for the floor→ceil fix.)

**4.5 Add/remove rows**
1. Add and remove weapons, skills, equipment, cyberware rows; confirm indices stay aligned (removing row 2 removes the right item) and Save persists the result.

---

## 5. Statblock Import 🔁

**5.1 Parse → preview → create**
1. NPC Template → **Import statblock** (or the import entry).
2. Paste a CPR NPC statblock, pick the language (en/pl), **Parse**.
3. Confirm the preview shows parsed stats, HP/SW/death save, armor, weapons, skills, equipment, cyberware, role; errors/warnings listed if any. A **Category** dropdown is shown (defaults to Uncategorized) — the GM picks the appropriate category before saving or creating.
4. **Create NPC** → actor created and populated (same expectations as §3.1).

**5.2 Save as template — name dialog (DialogV2)** 🔁
1. After a successful parse, **Save template** → a dialog prompts for a name, **pre-filled** with the parsed NPC name.
2. Edit the name to include a **double-quote** (e.g. `Arasaka "Ghost"`), confirm.

Expected: the dialog is a DialogV2 (modern styling), the input is correctly pre-filled, and the quote-containing name **saves without breaking the input** (regression guard for the HTML-interpolation fix). Cancelling/closing aborts with no save. The template then appears in the generator list.

**5.3 Regression — parser fixtures**
- `pnpm test` must be green; the fixture suite (`test/parser.test.mjs` + `test/unit/*`) is the authority for parser behavior. Re-run after any `scripts/import/**` or `data/import-maps/**` change.

---

## 6. Cross-cutting runtime checks 🔁

**6.1 Shared socket wiring**
1. As GM, open the **Store**. On a second **player** client, open the Store too.
2. GM changes markup / toggles a category / sets a price filter.

Expected: the player's open Store **refreshes** to reflect the change (store socket on the shared instance). Player-side creation still works (creator socket on the same instance). No "socket not registered" console errors at load (init order: shared → store → creator).

**6.2 NPC factory readiness (no fixed sleep)**
1. Create several NPCs back-to-back from different tiers, including a **nightmare-boss** (most items).

Expected: each opens fully populated with no console errors and no fixed ~1s stall. If any actor opens missing core skills/cyberware, the readiness poll's timeout may need raising (`scripts/npc/npc-factory.js`, `waitFor … timeoutMs`).

---

## 7. Store

**7.1 Player purchase / GM loot**
1. As a player with a character, open the Store, select your actor, browse a category, **Buy** an affordable item → confirm dialog shows cost/balance/after-balance → confirm → eurobucks deducted (ledger entry), item added to actor, success notification.
2. Try to buy an **unaffordable** item → the confirm button is disabled / purchase blocked.
3. As GM, **Loot** an item to a character (no cost) → item added, no deduction.

**7.2 GM availability controls** 🔁
1. As GM: toggle category visibility, set price min/max, **Reset price range**, **Hide** an item then **Restore** it, **Restore all**.

Expected: each control persists (re-open Store to confirm), broadcasts to other clients (§6.1), and re-renders. (These all route through the `#updateAvailability` helper now — verify none silently no-op.)

**7.3 Pack selection**
1. GM → store pack-exclusion config menu → exclude a pack/group → confirm those items disappear from the store; re-include restores them.

---

## Quick regression triage

| Symptom | Likely area | First file to check |
|---|---|---|
| Editor drops/replaces an item on save | §4 preserve logic | `scripts/utils/editor-options.js`, `npc-template-editor-app.js` `#readCurrentStep` |
| Serious Wound off by one (odd HP) | §2.1 / §4.4 | `scripts/utils/derived-stats.js` (must be `ceil`) |
| Save-template name dialog blank / breaks on quote | §5.2 | `statblock-import-app.js` DialogV2 `render`/`ok` callbacks |
| Player store doesn't refresh on GM change | §6.1 | `scripts/socket.js`, `store-socket.js` init order in `main.js` |
| NPC opens half-populated / 1s stall | §6.2 | `scripts/npc/npc-factory.js` `waitFor` predicate/timeout |
| All translations show raw keys | i18n | i18n JSON — a key that is both a leaf and a prefix (see CLAUDE.md) |
| `game.settings.get` "not registered" | startup | `scripts/main.js` settings registration |
