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

/** A rectangle in viewport coordinates. Structurally compatible with
 *  `DOMRect`, but plain so it can be built in tests without layout. */
export interface SelectionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The exact-on-the-edges block selection shape used for text
 *  selections that span more than one block. `first` / `last` keep
 *  the precise character extents on the first and last visual line,
 *  while `middle` is a full-width block covering every fully
 *  selected line between them (null when there is none). */
export interface BlockSelectionPieces {
  first: SelectionRect;
  middle: SelectionRect | null;
  last: SelectionRect;
}

/**
 * Turn the per-line client rects of a text selection into the block
 * preview shape:
 *
 *   * the first visual line is kept exact (from the selection start
 *     to the end of that line),
 *   * every fully selected line in between becomes one full-width
 *     block spanning the container, and
 *   * the last visual line is kept exact (from the start of that
 *     line to the selection end).
 *
 * This lets the block highlight cover whole elements while still
 * showing exactly where a partial first / last line begins and ends.
 */
export function computeBlockSelectionPieces(
  lineRects: readonly SelectionRect[],
  containerLeft: number,
  containerRight: number,
): BlockSelectionPieces | null {
  if (lineRects.length === 0) return null;

  const sorted = [...lineRects].sort((a, b) => a.top - b.top);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Only add the full-width middle when at least one whole line sits
  // between the first and last line. The half-pixel threshold
  // absorbs the sub-pixel seam between stacked line boxes.
  const hasMiddle = sorted.length > 1 && last.top > first.bottom + 0.5;

  return {
    first,
    middle: hasMiddle
      ? {
          left: containerLeft,
          top: first.bottom,
          right: containerRight,
          bottom: last.top,
        }
      : null,
    last,
  };
}

/**
 * The full list of overlay rectangles for a text selection:
 *
 *   * inside a single textblock the per-line client rects are used
 *     as-is, so a wrapped paragraph gets the browser-like, text-hugging
 *     shape (partial first / last line, precise middle lines), and
 *   * across blocks the first and last lines stay exact while every
 *     fully selected line in between collapses into one full-width
 *     block (see {@link computeBlockSelectionPieces}).
 */
export function planSelectionRects(
  lineRects: readonly SelectionRect[],
  spansBlocks: boolean,
  containerLeft: number,
  containerRight: number,
): SelectionRect[] {
  if (lineRects.length === 0) return [];
  if (!spansBlocks) return [...lineRects];

  const pieces = computeBlockSelectionPieces(
    lineRects,
    containerLeft,
    containerRight,
  );
  if (pieces === null) return [];

  const rects = [pieces.first];
  if (pieces.middle) rects.push(pieces.middle);
  rects.push(pieces.last);
  return rects;
}

/**
 * Run `measure` with every collaboration cursor widget temporarily
 * hidden, restoring the previous `display` afterwards.
 *
 * Remote caret widgets (`.collaboration-carets__caret`) live inside the
 * ProseMirror DOM and carry an absolutely-positioned name label at
 * `top: -1.4em`. A DOM `Range` that includes one returns the label's
 * box as well, which sits outside the text line. During a cross-block
 * selection that box sorts as the topmost (or bottommost) rect and
 * makes the block-shape helper paint a whole line instead of the
 * partial first/last line. Hiding the widgets for the synchronous
 * measurement keeps the rects anchored to the real text; nothing
 * repaints in between, so there is no flicker.
 */
export function withCollaborationCaretsHidden<T>(
  root: Element,
  measure: () => T,
): T {
  const carets = Array.from(
    root.querySelectorAll<HTMLElement>(".collaboration-carets__caret"),
  );
  if (carets.length === 0) return measure();
  const previous = carets.map((el) => el.style.display);
  for (const el of carets) el.style.display = "none";
  try {
    return measure();
  } finally {
    carets.forEach((el, i) => {
      el.style.display = previous[i];
    });
  }
}

/** Vertical overlap between two rects, or 0 when they don't touch. */
function verticalOverlap(a: SelectionRect, b: SelectionRect): number {
  return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

/**
 * Assign each next rect to an overlay "slot" so the animated pool can
 * reuse the same DOM element while the selection changes. Matching is
 * greedy by greatest vertical overlap, which keeps a highlight glued
 * to its line while the selection grows, shrinks or moves. Returns the
 * slot index for each next rect, or `-1` when a fresh slot is needed.
 */
export function assignRectsToSlots(
  previous: readonly (SelectionRect | null)[],
  next: readonly SelectionRect[],
): number[] {
  const slotOf = new Array<number>(next.length).fill(-1);
  const used = new Array<boolean>(previous.length).fill(false);

  const pairs: Array<{ piece: number; slot: number; score: number }> = [];
  for (let piece = 0; piece < next.length; piece++) {
    for (let slot = 0; slot < previous.length; slot++) {
      const prev = previous[slot];
      if (!prev) continue;
      const score = verticalOverlap(prev, next[piece]);
      if (score > 0) pairs.push({ piece, slot, score });
    }
  }
  // Highest overlap wins, so a line that already has its own slot is
  // claimed before a newly selected line can steal it.
  pairs.sort((a, b) => b.score - a.score);
  for (const { piece, slot } of pairs) {
    if (slotOf[piece] !== -1 || used[slot]) continue;
    slotOf[piece] = slot;
    used[slot] = true;
  }

  // Unmatched pieces: prefer already-hidden slots, then any free slot,
  // otherwise ask the caller to create a new one.
  for (let piece = 0; piece < next.length; piece++) {
    if (slotOf[piece] !== -1) continue;
    let slot = -1;
    for (let s = 0; s < previous.length; s++) {
      if (!used[s] && previous[s] === null) {
        slot = s;
        break;
      }
    }
    if (slot === -1) {
      for (let s = 0; s < previous.length; s++) {
        if (!used[s]) {
          slot = s;
          break;
        }
      }
    }
    if (slot !== -1) used[slot] = true;
    slotOf[piece] = slot;
  }

  return slotOf;
}

/** Minimal resolved-position shape: just enough to decide whether a
 *  selection stays inside one block. Keeping it structural means the
 *  helper stays testable without importing the ProseMirror model. */
export interface BlockParentLike {
  isTextblock: boolean;
}
export interface ResolvedPosLike {
  parent: BlockParentLike;
}

/** True when `from` and `to` don't both sit in the same textblock,
 *  i.e. the selection crosses paragraph / heading / cell boundaries
 *  (or is a whole-document selection) and therefore needs the custom
 *  block overlay. A selection contained in a single textblock is left
 *  to the browser's native highlight. The parent node identity check
 *  works because ProseMirror reuses node objects within a state. */
export function selectionSpansBlocks(
  from: ResolvedPosLike,
  to: ResolvedPosLike,
): boolean {
  return from.parent !== to.parent || !from.parent.isTextblock;
}
