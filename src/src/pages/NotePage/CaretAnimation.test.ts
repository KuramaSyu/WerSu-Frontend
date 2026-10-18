// Tier 1 tests for the CaretAnimation pure helper.
//
// The animated selection overlay in `CaretAnimation.tsx` paints over
// a `CellSelection` by unioning each cell's DOM rect. The union
// computation lives in `computeCellSelectionRect`, which we exercise
// here with stub DOM nodes and a stub `CellSelection` -- no editor,
// no Tiptap, no real layout. The `resolveCell` helper checks
// `dom instanceof HTMLElement`, so the suite runs under jsdom (a
// lightweight env, not pulling in MUI or Tiptap). Behaviour we care
// about:
//
//   * single cell -> the cell's own rect
//   * row of cells -> rect spanning leftmost-left to rightmost-right
//   * column of cells -> rect spanning topmost-top to bottommost-bottom
//   * block (rectangular) selection -> bounding rect of the cells
//   * empty / unmounted -> null (caller hides the overlay)
//   * view.nodeDOM throws -> that cell is skipped, others still count
//   * nested cell content -> climbs parentElement to the real <td>

// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { CellSelection } from "@tiptap/pm/tables";
import {
  computeCellSelectionRect,
  type NodeDomLookup,
} from "./CaretAnimation.helpers";

/** Plain-object stub of a `CellSelection` exposing just the one
 *  method the helper calls. The signature mirrors
 *  `prosemirror-tables` `CellSelection.forEachCell`. */
function stubCellSelection(cells: Array<{ pos: number }>): {
  forEachCell: CellSelection["forEachCell"];
} {
  return {
    forEachCell(cb) {
      for (const { pos } of cells) {
        // The real signature passes (node, pos); the helper ignores
        // the node and reads its own DOM via `nodeDOM`, so a stub
        // node is enough.
        cb({} as never, pos);
      }
    },
  };
}

/** Make a real `<td>` with a stubbed `getBoundingClientRect`. Using
 *  a real DOM element lets `resolveCell` pass the
 *  `dom instanceof HTMLElement` gate, just like it does in
 *  production. */
function makeCellStub(rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): HTMLElement {
  const cell = document.createElement("td");
  cell.getBoundingClientRect = () => rect as DOMRect;
  return cell;
}

/** Build a NodeDomLookup whose `nodeDOM(pos)` walks the cell map
 *  and returns the matching stub. Positions the helper doesn't
 *  ask about return null. */
function makeView(cellsByPos: Map<number, HTMLElement>): NodeDomLookup {
  return {
    nodeDOM(pos) {
      return cellsByPos.get(pos) ?? null;
    },
  };
}

describe("computeCellSelectionRect", () => {
  it("returns the cell's own rect for a single-cell selection", () => {
    const cell = makeCellStub({
      left: 100,
      top: 50,
      right: 200,
      bottom: 90,
    });
    const view = makeView(new Map([[7, cell]]));
    const sel = stubCellSelection([{ pos: 7 }]);

    expect(computeCellSelectionRect(view, sel as never)).toEqual({
      left: 100,
      top: 50,
      right: 200,
      bottom: 90,
    });
  });

  it("returns a row rect spanning the leftmost and rightmost cells", () => {
    // A 1x3 row: cells touch but have independent rects.
    const a = makeCellStub({ left: 0, top: 10, right: 50, bottom: 60 });
    const b = makeCellStub({ left: 50, top: 10, right: 100, bottom: 60 });
    const c = makeCellStub({ left: 100, top: 10, right: 150, bottom: 60 });
    const view = makeView(
      new Map<number, HTMLElement>([
        [1, a],
        [2, b],
        [3, c],
      ]),
    );
    const sel = stubCellSelection([{ pos: 1 }, { pos: 2 }, { pos: 3 }]);

    const rect = computeCellSelectionRect(view, sel as never);
    expect(rect).toEqual({
      left: 0,
      top: 10,
      right: 150,
      bottom: 60,
    });
  });

  it("returns a column rect spanning the topmost and bottommost cells", () => {
    // A 3x1 column stacked vertically with small visual gaps.
    const a = makeCellStub({ left: 20, top: 0, right: 80, bottom: 30 });
    const b = makeCellStub({ left: 20, top: 30, right: 80, bottom: 60 });
    const c = makeCellStub({ left: 20, top: 60, right: 80, bottom: 90 });
    const view = makeView(
      new Map<number, HTMLElement>([
        [10, a],
        [20, b],
        [30, c],
      ]),
    );
    const sel = stubCellSelection([{ pos: 10 }, { pos: 20 }, { pos: 30 }]);

    const rect = computeCellSelectionRect(view, sel as never);
    expect(rect).toEqual({
      left: 20,
      top: 0,
      right: 80,
      bottom: 90,
    });
  });

  it("returns a block rect covering the bounding box of all cells", () => {
    // 2x2 block; helper sees four cell rects and returns their
    // bounding box even when individual rows/columns don't align.
    const tl = makeCellStub({ left: 0, top: 0, right: 60, bottom: 40 });
    const tr = makeCellStub({ left: 60, top: 0, right: 120, bottom: 40 });
    const bl = makeCellStub({ left: 0, top: 40, right: 60, bottom: 80 });
    const br = makeCellStub({ left: 60, top: 40, right: 120, bottom: 80 });
    const view = makeView(
      new Map<number, HTMLElement>([
        [1, tl],
        [2, tr],
        [3, bl],
        [4, br],
      ]),
    );
    const sel = stubCellSelection([
      { pos: 1 },
      { pos: 2 },
      { pos: 3 },
      { pos: 4 },
    ]);

    const rect = computeCellSelectionRect(view, sel as never);
    expect(rect).toEqual({
      left: 0,
      top: 0,
      right: 120,
      bottom: 80,
    });
  });

  it("returns null when no cell resolves to a DOM element", () => {
    // Selection describes cells but the view's DOM lookup is empty
    // (e.g. the table is detached or hasn't been mounted yet).
    const view = makeView(new Map());
    const sel = stubCellSelection([{ pos: 1 }, { pos: 2 }]);

    expect(computeCellSelectionRect(view, sel as never)).toBeNull();
  });

  it("skips cells whose nodeDOM throws and still unions the rest", () => {
    const good = makeCellStub({ left: 0, top: 0, right: 50, bottom: 50 });
    const nodeDOM = vi.fn((pos: number) => {
      if (pos === 1) throw new Error("pos out of range");
      if (pos === 2) return good;
      return null;
    });
    const sel = stubCellSelection([{ pos: 1 }, { pos: 2 }]);

    const rect = computeCellSelectionRect({ nodeDOM }, sel as never);
    expect(rect).toEqual({
      left: 0,
      top: 0,
      right: 50,
      bottom: 50,
    });
  });

  it("uses parentElement to climb out of deeply-nested cell content", () => {
    // `view.nodeDOM(pos)` may return a `<p>` inside the cell, not
    // the `<td>` itself. The helper must walk up to the real cell
    // before reading its rect.
    const td = makeCellStub({ left: 5, top: 5, right: 95, bottom: 45 });
    const div = document.createElement("div");
    const p = document.createElement("p");
    div.appendChild(p);
    td.appendChild(div);
    const view: NodeDomLookup = { nodeDOM: () => p };
    const sel = stubCellSelection([{ pos: 1 }]);

    expect(computeCellSelectionRect(view, sel as never)).toEqual({
      left: 5,
      top: 5,
      right: 95,
      bottom: 45,
    });
  });
});
