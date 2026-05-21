// scripts/utils/editor-options.js
// Pure helpers for the NPC template editor's <select> lists. They let the
// editor round-trip items that are NOT in its hardcoded option lists, instead
// of silently coercing them to the first preset (the old data-loss bug).

export const PRESERVE_ID = "__preserve_current__";

// Build option rows for a select. `presets` are the hardcoded options; `current`
// is the item currently on the template (or null). `idOf(preset)` yields the
// option value; `labelKey` names the preset field used as the visible label.
// If `current` matches no preset (by itemName), append a PRESERVE option that
// shows the current item's name and is selected. Returns { options, preserved }.
export function buildOptions(presets, current, idOf, labelKey) {
  const curName = current?.itemName || null; // treat "" the same as absent
  const match = curName != null ? presets.find(p => p.itemName === curName) : null;
  const options = presets.map(p => ({
    id: idOf(p),
    label: p[labelKey] ?? p.itemName,
    selected: match != null && idOf(p) === idOf(match),
  }));
  if (curName != null && !match) {
    options.push({ id: PRESERVE_ID, label: curName, selected: true });
    return { options, preserved: true };
  }
  return { options, preserved: false };
}

// Map a selected preset id back to its full option object, or null if not
// found. The PRESERVE_ID case is handled by callers (they round-trip the
// original item directly), so this helper only does preset lookup.
export function resolveSelection(selectedId, presets) {
  return presets.find(p => p.id === selectedId) ?? null;
}
