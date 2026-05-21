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
  const curName = current?.itemName ?? null;
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

// Map a selected option value back to a full item object. PRESERVE_ID returns
// the untouched original; a preset id returns that preset; otherwise null.
export function resolveSelection(selectedId, presets, current) {
  if (selectedId === PRESERVE_ID) return current ?? null;
  return presets.find(p => p.id === selectedId) ?? null;
}
