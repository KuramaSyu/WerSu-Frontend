// Low-level ProseMirror table operations shared by every surface
// that edits a table (bubble menu, right-click menu, toolbars).
//
// Keeping these out of the presentational layers means there is one
// implementation per operation. The command catalogue in
// tableCommands.ts wires labels and icons on top, and the bubble
// strategies and right-click presets both build from that catalogue.

import type { Editor } from "@tiptap/core";
import { CellSelection, TableMap } from "@tiptap/pm/tables";

// Tiptap ships no clearCells, so walk forEachCell and replace each
// cell body with an empty paragraph.
export function clearCells(editor: Editor): void {
  const sel = editor.state.selection;
  if (sel instanceof CellSelection) {
    const { tr } = editor.state;
    const empty = editor.schema.nodes.paragraph?.create();
    if (!empty) return;
    const replacements: Array<{ from: number; to: number }> = [];
    sel.forEachCell((cellNode, pos) => {
      if (cellNode.content.size > 0) {
        replacements.push({ from: pos + 1, to: pos + cellNode.nodeSize - 1 });
      }
    });
    // Right-to-left so earlier positions stay valid.
    for (const { from, to } of replacements.reverse()) {
      tr.replaceWith(from, to, empty);
    }
    editor.view.dispatch(tr);
    editor.view.focus();
    return;
  }
  editor.chain().focus().deleteSelection().run();
}

// Tiptap's moveRow only handles a single row; do a full-table
// replace. We swap row nodes in the table's row array and reinstall a
// CellSelection.rowSelection on the new row so the menu stays in place
// across the swap. Using rowSelection (not CellSelection.create) is
// important: the factory expands anchor/head to the full row band,
// which avoids the last cell's text leaking into the selection rect.
export function moveRowsByDelta(
  editor: Editor,
  delta: -1 | 1,
  indices: number[],
): void {
  const { state } = editor;
  const { $from } = state.selection;
  let tableDepth = -1;
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === "table") {
      tableDepth = d;
      break;
    }
  }
  if (tableDepth === -1) return;

  const tableNode = $from.node(tableDepth);
  const tablePos = (
    $from as unknown as { before: (d: number) => number }
  ).before(tableDepth);
  const map = TableMap.get(tableNode);

  // Bounds check. Bail out (no-op) when the band already touches the
  // destination edge.
  if (delta === -1 && indices[0] === 0) return;
  if (delta === 1 && indices[indices.length - 1] === map.height - 1) return;

  // Build a fresh row array with the band shifted by one. Plain node
  // references from table.content.content are reused; only the table
  // itself is re-created.
  const rows = tableNode.content.content.slice();
  if (delta === -1) {
    for (const idx of indices) {
      [rows[idx - 1], rows[idx]] = [rows[idx], rows[idx - 1]];
    }
  } else {
    for (const idx of [...indices].reverse()) {
      [rows[idx + 1], rows[idx]] = [rows[idx], rows[idx + 1]];
    }
  }

  const newTable = tableNode.type.create(
    tableNode.attrs,
    rows,
    tableNode.marks,
  );

  // Compute where the band lands in the new table so the first and
  // last cell positions feed rowSelection, which expands the band to
  // the full row extent.
  const newMap = TableMap.get(newTable);
  const newTopRow =
    delta === -1 ? indices[0] - 1 : indices[indices.length - 1] + 1;
  const newBotRow = newTopRow + indices.length - 1;
  const firstCellPos =
    tablePos + 1 + newMap.positionAt(newTopRow, 0, newTable);
  const lastCellPos =
    tablePos + 1 + newMap.positionAt(newBotRow, map.width - 1, newTable);

  const tr = state.tr
    .replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable)
    // Prevent the autolink plugin from re-scanning the new table.
    .setMeta("preventAutolink", true);
  // Resolve against the new doc so the positions point into it.
  const newDoc = tr.doc;
  tr.setSelection(
    CellSelection.rowSelection(
      newDoc.resolve(firstCellPos),
      newDoc.resolve(lastCellPos),
    ),
  );

  editor.view.dispatch(tr);
  editor.view.focus();
}

// Column analogue of moveRowsByDelta. Re-orders each row's cell array
// and restores a colSelection on the moved band.
export function moveColumnsByDelta(
  editor: Editor,
  delta: -1 | 1,
  indices: number[],
): void {
  const { state } = editor;
  const { $from } = state.selection;
  let tableDepth = -1;
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === "table") {
      tableDepth = d;
      break;
    }
  }
  if (tableDepth === -1) return;

  const tableNode = $from.node(tableDepth);
  const tablePos = (
    $from as unknown as { before: (d: number) => number }
  ).before(tableDepth);
  const map = TableMap.get(tableNode);

  if (delta === -1 && indices[0] === 0) return;
  if (delta === 1 && indices[indices.length - 1] === map.width - 1) return;

  // Build a fresh row array where each row's cells are re-ordered
  // according to the band shift.
  const rows = tableNode.content.content.map((row) => {
    const cells = row.content.content.slice();
    if (delta === -1) {
      for (const idx of indices) {
        [cells[idx - 1], cells[idx]] = [cells[idx], cells[idx - 1]];
      }
    } else {
      for (const idx of [...indices].reverse()) {
        [cells[idx + 1], cells[idx]] = [cells[idx], cells[idx + 1]];
      }
    }
    return row.type.create(row.attrs, cells, row.marks);
  });

  const newTable = tableNode.type.create(
    tableNode.attrs,
    rows,
    tableNode.marks,
  );

  // Restore the CellSelection on the moved band using colSelection.
  const newMap = TableMap.get(newTable);
  const newLeftCol =
    delta === -1 ? indices[0] - 1 : indices[indices.length - 1] + 1;
  const newRightCol = newLeftCol + indices.length - 1;
  const firstCellPos =
    tablePos + 1 + newMap.positionAt(0, newLeftCol, newTable);
  const lastCellPos =
    tablePos +
    1 +
    newMap.positionAt(map.height - 1, newRightCol, newTable);

  const tr = state.tr
    .replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable)
    .setMeta("preventAutolink", true);
  const newDoc = tr.doc;
  tr.setSelection(
    CellSelection.colSelection(
      newDoc.resolve(firstCellPos),
      newDoc.resolve(lastCellPos),
    ),
  );

  editor.view.dispatch(tr);
  editor.view.focus();
}
