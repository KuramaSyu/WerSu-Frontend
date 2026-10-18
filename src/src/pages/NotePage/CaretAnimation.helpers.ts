// CaretAnimation helpers
//
// Pure DOM/ProseMirror helpers shared by `CaretAnimation.tsx` and
// its unit tests. Kept in their own file so tests can import the
// helpers without pulling in the extension's MUI / zustand
// dependencies (which transitively hit a deep ESM graph Vite's
// resolver refuses to handle).

import type { CellSelection } from "@tiptap/pm/tables";

/** A minimal DOM-lookup shape the cell-selection rect helper needs.
 *  Lets the helper stay pure (no editor / view imports) so it can
 *  be unit-tested with a stub. */
export interface NodeDomLookup {
  nodeDOM(pos: number): Node | null;
}

// ProseMirror returns the deepest node at a position (often a
// paragraph or text node inside a cell); climb up until we find a
// real <td> / <th>.
export function resolveCell(dom: Node | null): HTMLElement | null {
  let el: HTMLElement | null =
    dom instanceof HTMLElement ? dom : (dom?.parentElement ?? null);
  while (el && el.tagName !== "TD" && el.tagName !== "TH") {
    el = el.parentElement;
  }
  return el;
}

/** Visual rect that encloses every selected cell, in viewport
 *  coordinates. Returns null when no cell in the selection has a
 *  measurable DOM rect (e.g. the table is detached, or the editor
 *  is still rendering). */
export function computeCellSelectionRect(
  view: NodeDomLookup,
  selection: CellSelection,
): { left: number; top: number; right: number; bottom: number } | null {
  const rects: DOMRect[] = [];
  selection.forEachCell((_node, pos) => {
    let dom: Node | null = null;
    try {
      dom = view.nodeDOM(pos);
    } catch {
      return;
    }
    const cell = resolveCell(dom);
    if (cell) {
      rects.push(cell.getBoundingClientRect());
    }
  });
  if (rects.length === 0) return null;

  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, right, bottom };
}
