# Stats Table Redesign — Transposed Layout with Click-to-Select

## Summary

Redesign the stats step UI for all three character creation methods (streetrat, edgerunner, complete package) to use a unified row-per-stat table style. Streetrat and edgerunner switch from a flat 5-column grid to a transposed 10×10 table showing all template values, with click-to-select and per-row dice (edgerunner only). Point-buy adopts the same row styling but keeps its +/- budget logic.

## Scope

**In scope:**
- Rewrite `stats-roll.hbs` template with transposed table layout
- Restyle `stats-pointbuy.hbs` to match the new row-per-stat visual style
- Update `step-stats.js` click/roll handlers for the new interaction model
- Update CSS in `creator.css` for new table classes
- Track column selection state for highlighting

**Out of scope:**
- Role data format changes (statTemplates arrays stay as-is)
- Derived stats step (unchanged)
- Summary step stat display (unchanged)

## Design

### Data Model

The role JSON `statTemplates` is a 10×10 array: `statTemplates[rowIndex][statIndex]`. Currently accessed row-first (streetrat picks a row). The transposed UI accesses it column-first: for stat `i`, display `statTemplates[0][i]` through `statTemplates[9][i]` across the columns.

No changes to the role JSON files. The transposition is purely a UI concern handled in `prepareContext()`.

### Template Context

`prepareContext()` builds a `statRows` array for the template:

```js
statRows: [
  {
    key: "int",
    abbr: "INT",
    fullName: "Intelligence",
    values: [7, 5, 4, 6, 7, 5, 7, 8, 4, 6],  // statTemplates[0..9][0]
    selectedCol: 4,  // 0-indexed column, or null if unselected
  },
  // ... one per stat
]
```

For point-buy, `statRows` keeps the current shape (no `values` array, just `key`, `abbr`, `fullName`, `value`).

### Selection State

Stored on the `StepStats` instance (survives re-renders but not page reload — acceptable since stats are written to `state.stats` which is persistent):

- **Streetrat:** `this._selectedColumn` — single integer (0-9) or `null`. Clicking any cell sets this to that cell's column index and updates all `state.stats` from `statTemplates[selectedColumn][statIndex]`.
- **Edgerunner:** `this._selectedColumns` — object `{ int: 3, ref: 7, ... }` mapping stat keys to column indices. Starts empty. Clicking a cell sets that stat's column. Each stat can have a different column.

### Interaction Rules

#### Streetrat

| Action | Behavior |
|--------|----------|
| Click any cell | Highlight entire column, update all `state.stats` from that template column |
| Roll 1d10 button | Roll, select that column (same as clicking it), post roll to chat |
| Re-click different column | Replaces previous selection |
| Initial state | No column selected, all values visible at normal brightness |

#### Edgerunner

| Action | Behavior |
|--------|----------|
| Click a cell | Highlight that cell, update `state.stats[statKey]`, mark row as selected |
| Per-row dice button | Roll 1d10 for that stat, select the rolled column for that row |
| "Roll All" button | If any stats unselected: roll only unselected stats. If all selected: re-roll all 10 stats |
| Unselected row | Dimmed text (stat label + all value cells). Still clickable for manual selection |
| Re-click different cell in same row | Moves highlight to new cell, updates stat value |
| Chat messages | Per-row rolls post to chat. "Roll All" posts a summary to chat |

#### Complete Package (Point-Buy)

| Action | Behavior |
|--------|----------|
| +/- buttons | Increment/decrement stat within 2-8 range if budget allows |
| Budget bar | Shows remaining points out of 62 |
| No changes to logic | Only visual restyling to match the row-per-stat table look |

### Validation

- **Streetrat:** All stats must have a selection (i.e. `this._selectedColumn !== null`) before proceeding. This means a column has been clicked or rolled.
- **Edgerunner:** All 10 stats must have a selection (`this._selectedColumns` has all 10 keys) before proceeding.
- **Point-buy:** Unchanged — total must equal 62, each stat 2-8.

### Template Structure

Single `stats-roll.hbs` for both streetrat and edgerunner (approach A). The only conditional difference is:
- Edgerunner shows a dice button column (`<th>` + `<td>` with dice button per row)
- Edgerunner shows "Roll All" in the header; streetrat shows "Roll 1d10"
- Edgerunner uses per-cell highlighting; streetrat uses per-column highlighting via CSS classes

`stats-pointbuy.hbs` is restyled to use the same CSS table classes but keeps its own template with +/- buttons and budget bar.

### CSS Changes

New/modified classes in `creator.css`:

- `.crw-stat-table` — base table styling (border-spacing, font)
- `.crw-stat-table th` — column header styling (1-10 numbers)
- `.crw-stat-table td` — cell base styling with cursor:pointer for clickable cells
- `.crw-stat-table td.crw-selected` — red background highlight for selected cells
- `.crw-stat-table tr.crw-dimmed td` — dimmed text color for unselected edgerunner rows
- `.crw-stat-table .crw-stat-label` — stat abbreviation cell (left column, red text)
- `.crw-stat-dice-btn` — per-row dice button styling
- `.crw-stat-table th.crw-selected-col` — highlighted column header number (streetrat)

Remove/replace:
- `.crw-stat-grid` (old 5-column grid) — replaced by table
- `.crw-stat-cell` — no longer needed
- `.crw-stat-cell-value` — no longer needed (cells are read-only, no inputs)

Keep `.crw-stat-row`, `.crw-stat-abbr`, `.crw-stat-name`, `.crw-stat-value`, `.crw-stat-btn` for point-buy (restyled but structurally similar).

### Removed Elements

- **Roll result banner** (`crw-roll-result`): The old "Roll result: X → Row X" banner is removed. The column/cell highlighting makes the result visually obvious, and the roll is still posted to Foundry chat for the record.
- **Number inputs**: Cells are read-only `<td>` elements, not `<input>`. The `serialize()` method no longer needs to read values from the DOM in roll mode — `state.stats` is updated directly on click/roll events. `serialize()` for roll mode becomes a no-op (stats are already in state).
- **Override hint**: The "values are editable" hint is removed since cells are no longer editable. The click-to-select interaction is self-evident.

### Files Changed

| File | Change |
|------|--------|
| `scripts/steps/step-stats.js` | New `_activateRoll()` with click-to-select handlers, column selection state, updated roll logic |
| `templates/steps/stats-roll.hbs` | Full rewrite: transposed table with conditional dice column |
| `templates/steps/stats-pointbuy.hbs` | Restyle to match row-per-stat visual, keep +/- logic |
| `templates/partials/stat-row.hbs` | Update for new point-buy row styling |
| `styles/creator.css` | New table classes, remove old grid classes |

### Mockups

Visual mockups are in `.superpowers/brainstorm/` — files `stats-layout-v2.html` and `stats-layout-v3.html` show the approved design for all three methods.
