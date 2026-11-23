// View-only table sorting helpers.
//
// Tables are rendered by ProseMirror, so re-ordering the document's
// row nodes would mutate the note. Instead the node view sorts the
// row elements in the DOM while the editor is read-only and restores
// the original order as soon as the table becomes editable again.
//
// The original position of each row is remembered on the element via
// `data-table-sort-original-index`, which makes the restore step
// independent of the current visual order.

export type TableSortDirection = "asc" | "desc";

export interface TableSortState {
  columnIndex: number;
  direction: TableSortDirection;
}

const ORIGINAL_INDEX_ATTR = "tableSortOriginalIndex";

// `numeric` gives "Row 2" < "Row 10"; `base` makes case/diacritics
// irrelevant so "apple" and "Apple" compare as equal.
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const isEmpty = (value: string): boolean => value.trim().length === 0;

/**
 * Compare two cell values for view-only sorting.
 *
 * Empty cells always sort last, regardless of direction, so descending
 * order does not push blank rows to the top.
 */
export function compareTableCells(
  left: string,
  right: string,
  direction: TableSortDirection,
): number {
  const leftEmpty = isEmpty(left);
  const rightEmpty = isEmpty(right);
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  const result = collator.compare(left, right);
  return direction === "asc" ? result : -result;
}

export function getCellText(
  row: HTMLTableRowElement,
  columnIndex: number,
): string {
  return row.cells[columnIndex]?.textContent ?? "";
}

/** Return the rows that belong directly to the table node view. */
export function getTableRows(root: HTMLElement | null): HTMLTableRowElement[] {
  if (!root) return [];
  return Array.from(root.children).filter(
    (child): child is HTMLTableRowElement =>
      child.tagName.toLowerCase() === "tr",
  );
}

/** A table has a header row when its first row contains `<th>` cells. */
export function tableHasHeaderRow(rows: readonly HTMLTableRowElement[]): boolean {
  const firstRow = rows[0];
  if (!firstRow) return false;
  return Array.from(firstRow.cells).some(
    (cell) => cell.tagName.toLowerCase() === "th",
  );
}

/**
 * Stable sort of data rows by one column. The header row, when
 * present, is not included in `rows` (the caller passes only body
 * rows).
 */
export function sortTableRows(
  rows: readonly HTMLTableRowElement[],
  columnIndex: number,
  direction: TableSortDirection,
): HTMLTableRowElement[] {
  return [...rows].sort((left, right) =>
    compareTableCells(
      getCellText(left, columnIndex),
      getCellText(right, columnIndex),
      direction,
    ),
  );
}

function ensureOriginalIndexes(rows: readonly HTMLTableRowElement[]): void {
  rows.forEach((row, index) => {
    if (row.dataset[ORIGINAL_INDEX_ATTR] === undefined) {
      row.dataset[ORIGINAL_INDEX_ATTR] = String(index);
    }
  });
}

/**
 * Sort the DOM rows of a table node view. This only reorders elements;
 * no ProseMirror transaction is dispatched and the document is never
 * changed.
 */
export function applyTableSort(
  root: HTMLElement | null,
  columnIndex: number,
  direction: TableSortDirection,
): void {
  const rows = getTableRows(root);
  if (!root || rows.length === 0) return;

  ensureOriginalIndexes(rows);

  const hasHeader = tableHasHeaderRow(rows);
  const bodyRows = hasHeader ? rows.slice(1) : rows;
  if (bodyRows.length < 2) return;

  const sorted = sortTableRows(bodyRows, columnIndex, direction);
  const fragment = document.createDocumentFragment();
  for (const row of sorted) fragment.appendChild(row);

  // With a header row, the header stays as the first child and the
  // sorted body rows are appended after it.
  root.appendChild(fragment);
}

/**
 * Put the rows back into document order and drop the bookkeeping
 * attribute. Called when sorting is cleared, when the editor becomes
 * editable, and when the node view unmounts.
 */
export function restoreTableRowOrder(root: HTMLElement | null): void {
  const rows = getTableRows(root);
  if (!root || rows.length === 0) return;

  const indexed: HTMLTableRowElement[] = [];
  const unindexed: HTMLTableRowElement[] = [];
  for (const row of rows) {
    if (row.dataset[ORIGINAL_INDEX_ATTR] === undefined) unindexed.push(row);
    else indexed.push(row);
  }
  if (indexed.length === 0) return;

  indexed.sort(
    (left, right) =>
      Number(left.dataset[ORIGINAL_INDEX_ATTR]) -
      Number(right.dataset[ORIGINAL_INDEX_ATTR]),
  );

  const fragment = document.createDocumentFragment();
  for (const row of [...indexed, ...unindexed]) {
    delete row.dataset[ORIGINAL_INDEX_ATTR];
    fragment.appendChild(row);
  }
  root.appendChild(fragment);
}
