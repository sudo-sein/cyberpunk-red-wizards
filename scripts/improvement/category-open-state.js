/**
 * Decide whether a skill category should render open.
 * Filtering temporarily opens visible categories; otherwise user toggles own state.
 * Cart deltas are intentionally ignored so planned changes do not force categories open.
 * @param {{ key: string, filterValue?: string, openStates?: Map<string, boolean>, hasPlannedRows?: boolean }} params
 * @returns {boolean}
 */
export function categoryIsOpen({ key, filterValue = "", openStates = new Map() }) {
  if (filterValue.trim()) return true;
  return openStates.get(key) ?? false;
}
