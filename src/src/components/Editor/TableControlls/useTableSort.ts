import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useState } from "react";
import {
  applyTableSort,
  getTableRows,
  restoreTableRowOrder,
  type TableSortState,
} from "./tableSorting";

export interface TableSortControl {
  columnIndex: number;
  /** Position relative to the table node view wrapper. */
  left: number;
  top: number;
  width: number;
  height: number;
}

const CONTROL_SIZE = 26;
const CONTROL_MARGIN = 4;

function sameControls(
  left: readonly TableSortControl[],
  right: readonly TableSortControl[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      item.columnIndex === other.columnIndex &&
      item.left === other.left &&
      item.top === other.top &&
      item.width === other.width &&
      item.height === other.height
    );
  });
}

/**
 * View-only column sorting for a table node view.
 *
 * `editor.isEditable` is the app's edit/view switch. Sorting buttons
 * and DOM row re-ordering are only active while the editor is
 * read-only; leaving view mode restores the original row order before
 * ProseMirror can observe a mismatch.
 */
export function useTableSort(
  editor: Editor,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
) {
  // `useEditorState` only observes ProseMirror transactions, but
  // `editor.setEditable(...)` emits an update without a transaction.
  // Subscribe to both so the controls disappear the moment the note
  // flips back to edit mode.
  const [isEditable, setIsEditable] = useState(editor.isEditable);
  useEffect(() => {
    const sync = () => setIsEditable(editor.isEditable);
    sync();
    editor.on("update", sync);
    editor.on("transaction", sync);
    return () => {
      editor.off("update", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  const [sort, setSort] = useState<TableSortState | null>(null);
  const [controls, setControls] = useState<TableSortControl[]>([]);

  const getRoot = useCallback((): HTMLElement | null => {
    return (
      wrapperRef.current?.querySelector<HTMLElement>(
        "[data-node-view-content-react]",
      ) ?? null
    );
  }, [wrapperRef]);

  // Measure the first row so the sort buttons sit in each column's
  // top-right corner without being part of the ProseMirror content.
  const measure = useCallback(() => {
    const wrapper = wrapperRef.current;
    const root = getRoot();
    if (!wrapper || !root || editor.isDestroyed) {
      setControls((previous) => (previous.length === 0 ? previous : []));
      return;
    }

    const firstRow = getTableRows(root)[0];
    if (!firstRow) {
      setControls((previous) => (previous.length === 0 ? previous : []));
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const next = Array.from(firstRow.cells).map((cell, columnIndex) => {
      const rect = cell.getBoundingClientRect();
      return {
        columnIndex,
        left:
          rect.right - wrapperRect.left - CONTROL_SIZE - CONTROL_MARGIN,
        top: rect.top - wrapperRect.top + CONTROL_MARGIN,
        width: CONTROL_SIZE,
        height: CONTROL_SIZE,
      };
    });

    setControls((previous) => (sameControls(previous, next) ? previous : next));
  }, [editor, getRoot, wrapperRef]);

  // Apply or clear the view-only row order.
  useEffect(() => {
    const root = getRoot();
    if (!root) return;

    if (isEditable || !sort) {
      restoreTableRowOrder(root);
      return;
    }

    applyTableSort(root, sort.columnIndex, sort.direction);
  }, [getRoot, isEditable, sort]);

  // Collaborative updates can rebuild the rows while the note is in
  // view mode. Re-apply the visual order after those updates.
  useEffect(() => {
    if (isEditable || !sort) return;

    const handleUpdate = () => {
      const root = getRoot();
      if (!root) return;
      applyTableSort(root, sort.columnIndex, sort.direction);
      measure();
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, getRoot, isEditable, measure, sort]);

  // Keep the buttons aligned when the table is resized (images load,
  // viewport changes, side panels open, ...).
  useEffect(() => {
    if (isEditable) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let frame = 0;
    const scheduleMeasure = () => {
      if (typeof window.requestAnimationFrame !== "function") {
        measure();
        return;
      }
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(scheduleMeasure)
        : null;
    observer?.observe(wrapper);
    const root = getRoot();
    if (root) observer?.observe(root);
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      if (typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [getRoot, isEditable, measure, wrapperRef]);

  // Never leave DOM rows re-ordered once the node view is gone.
  useEffect(() => {
    return () => {
      restoreTableRowOrder(getRoot());
    };
  }, [getRoot]);

  // Cycle: unsorted -> ascending -> descending -> unsorted.
  const toggleSort = useCallback((columnIndex: number) => {
    setSort((previous) => {
      if (previous?.columnIndex !== columnIndex) {
        return { columnIndex, direction: "asc" };
      }
      if (previous.direction === "asc") {
        return { columnIndex, direction: "desc" };
      }
      return null;
    });
  }, []);

  return { isEditable, sort, controls, toggleSort };
}
