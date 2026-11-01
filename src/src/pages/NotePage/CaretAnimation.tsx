// CaretAnimation
// Tiptap extension that swaps the browser-native caret for a smooth
// sliding overlay. The overlay is a sibling DOM element appended to
// the editor container; `view.coordsAtPos` drives a
// `transform: translate3d(...)` on every plugin update, and the
// global stylesheet owns the transition so the browser reliably
// interpolates each change. `caret-color: transparent` on
// `.ProseMirror` hides the native caret (see tiptap.css).
//
// The custom overlay always paints the selection, using two shapes:
//   * inside a single textblock (paragraph, heading, cell, code
//     line, ...) the per-line client rects are used as-is, giving
//     the browser-like, text-hugging shape with precise partial
//     first / last lines, and
//   * across block boundaries the first and last visual lines stay
//     exact while every fully selected line in between becomes one
//     full-width block, so messy multi-element selections read as a
//     block without hiding where they start and end.
//
// Rectangles live in a reusable pool matched by vertical overlap, so
// each one keeps its DOM element and the CSS transition animates the
// change instead of the highlight popping between positions.
// Table cell selections (single cell, row, column, block) are
// unioned into one solid block as before, via `view.nodeDOM(pos)`.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { CellSelection } from "@tiptap/pm/tables";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useThemeStore } from "../../zustand/useThemeStore";
import { alpha } from "@mui/material/styles";
import {
  assignRectsToSlots,
  computeCellSelectionRect,
  planSelectionRects,
  selectionSpansBlocks,
  type SelectionRect,
} from "./CaretAnimation.helpers";

export interface CaretAnimationOptions {
  /** Disable the overlay entirely. The extension always reads
   *  `useEditorSettings.editMode` on every decoration rebuild, so
   *  the overlay is hidden in read mode without rebuilding the
   *  editor even when `enabled` is `true`. */
  enabled?: boolean;
}

const KEY = new PluginKey("caret-animation");

const CARET_CLASS = "pm-animated-caret";
const BLINK_CLASS = "pm-animated-caret--blinking";
const SELECTION_CLASS = "pm-animated-selection";

/** Idle ms before the caret starts blinking again. Matches
 *  Chrome's ~530ms half-period. */
const BLINK_IDLE_MS = 530;

function createCaretElement(): HTMLElement {
  const caretEl = document.createElement("div");
  caretEl.className = CARET_CLASS;
  return caretEl;
}

function createSelectionElement(background: string): HTMLElement {
  const selectionEl = document.createElement("div");
  selectionEl.className = SELECTION_CLASS;
  selectionEl.style.backgroundColor = background;
  return selectionEl;
}

/** Position an overlay element over a viewport-space rect, relative
 *  to the editor container. */
function positionRect(
  el: HTMLElement,
  rect: SelectionRect,
  containerRect: DOMRect,
): void {
  el.style.transform = `translate3d(${rect.left - containerRect.left}px, ${
    rect.top - containerRect.top
  }px, 0)`;
  el.style.width = `${rect.right - rect.left}px`;
  el.style.height = `${rect.bottom - rect.top}px`;
}

/** Per-visual-line client rects of the current text selection, in
 *  viewport coordinates. Built from the editor positions (rather than
 *  `window.getSelection()`) so it always matches the ProseMirror state
 *  even during transactions where the DOM selection lags behind. */
function getSelectionLineRects(
  view: EditorView,
  from: number,
  to: number,
): SelectionRect[] {
  const fromDom = view.domAtPos(from);
  const toDom = view.domAtPos(to);
  const range = document.createRange();
  range.setStart(fromDom.node, fromDom.offset);
  range.setEnd(toDom.node, toDom.offset);
  return Array.from(range.getClientRects())
    .map((r) => ({
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
    }))
    .filter((r) => r.right - r.left > 0 && r.bottom - r.top > 0);
}

export const CaretAnimation = Extension.create<CaretAnimationOptions>({
  name: "caretAnimation",

  addOptions() {
    return { enabled: true };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: KEY,

        view(editorView) {
          const caretEl = createCaretElement();
          const computeHoverBg = () => {
            const theme = useThemeStore.getState().theme;
            return alpha(
              theme.blendWithContrast(
                theme.palette.primary.main,
                0.3,
                "primary",
              ),
              0.3,
            );
          };
          const container = editorView.dom.parentNode as HTMLElement | null;
          if (!container) {
            return {
              destroy() {
                caretEl.remove();
              },
            };
          }
          container.appendChild(caretEl);

          // A selection is painted by a pool of overlay rectangles:
          // one per visual line inside a single block, or first /
          // middle / last across blocks. Slots are reused across
          // updates (matched by overlap) so each rectangle keeps its
          // identity and the CSS transition animates every change.
          interface Slot {
            el: HTMLElement;
            rect: SelectionRect | null;
          }
          const slots: Slot[] = [];
          const createSlot = (): Slot => {
            const el = createSelectionElement(computeHoverBg());
            container.appendChild(el);
            const slot = { el, rect: null };
            slots.push(slot);
            return slot;
          };
          const hideSelectionEls = () => {
            for (const slot of slots) {
              slot.el.style.display = "none";
              slot.rect = null;
            }
          };

          let blinkTimer: number | null = null;
          const stopBlinkTimer = () => {
            if (blinkTimer !== null) {
              window.clearTimeout(blinkTimer);
              blinkTimer = null;
            }
          };
          const pauseBlink = () => caretEl.classList.remove(BLINK_CLASS);
          const scheduleBlink = () => {
            stopBlinkTimer();
            blinkTimer = window.setTimeout(() => {
              caretEl.classList.add(BLINK_CLASS);
              blinkTimer = null;
            }, BLINK_IDLE_MS);
          };

          // Theme changes live outside ProseMirror, so paint the
          // selection background directly from the subscribe callback.
          const unsubscribeTheme = useThemeStore.subscribe(() => {
            const background = computeHoverBg();
            for (const slot of slots) slot.el.style.backgroundColor = background;
          });

          // Paint a set of rects, reusing pooled elements by vertical
          // overlap so every rectangle animates from its previous
          // place instead of popping in at a new spot.
          const paintSelection = (
            rects: SelectionRect[],
            containerRect: DOMRect,
          ) => {
            const slotOf = assignRectsToSlots(
              slots.map((slot) => slot.rect),
              rects,
            );
            const assignments: (SelectionRect | null)[] = slots.map(
              () => null,
            );
            for (let i = 0; i < rects.length; i++) {
              let slot = slotOf[i];
              if (slot === -1) {
                createSlot();
                assignments.push(null);
                slot = slots.length - 1;
              }
              assignments[slot] = rects[i];
            }
            for (let i = 0; i < slots.length; i++) {
              const rect = assignments[i];
              if (rect) {
                positionRect(slots[i].el, rect, containerRect);
                slots[i].el.style.display = "block";
                slots[i].rect = rect;
              } else {
                slots[i].el.style.display = "none";
                slots[i].rect = null;
              }
            }
          };

          return {
            update(view) {
              const editMode = useEditorSettings.getState().editMode;
              const { selection } = view.state;
              const containerRect = container.getBoundingClientRect();

              const isCellSelection = selection instanceof CellSelection;
              const isNodeSelection = selection instanceof NodeSelection;

              // Cell selection (table): the editor state carries a
              // `CellSelection` whose `from` / `to` positions are
              // just the start and end cells - they don't represent
              // a meaningful rect. Walk every selected cell, take
              // its DOM rect, and draw a single block over the
              // union. Works for single-cell, row, column, and
              // block (rectangular) selections.
              if (isCellSelection) {
                caretEl.style.display = "none";
                stopBlinkTimer();
                try {
                  const rect = computeCellSelectionRect(view, selection);
                  if (rect === null) {
                    hideSelectionEls();
                    return;
                  }
                  paintSelection([rect], containerRect);
                } catch {
                  hideSelectionEls();
                }
                return;
              }

              // A selected atom node (image, embed) draws its own
              // outline in the node view; the translucent selection
              // block would sit on top of it as an unwanted
              // background highlight.
              if (isNodeSelection) {
                caretEl.style.display = "none";
                stopBlinkTimer();
                hideSelectionEls();
                return;
              }

              // Active text selection. Inside one textblock the
              // per-line rects give the browser-like, text-hugging
              // shape; across blocks the first and last lines stay
              // exact while every fully selected line between them
              // becomes one full-width block (see planSelectionRects).
              // The overlay works in both edit and view mode; only the
              // caret below is edit-only.
              if (!selection.empty) {
                caretEl.style.display = "none";
                stopBlinkTimer();
                try {
                  const lineRects = getSelectionLineRects(
                    view,
                    selection.from,
                    selection.to,
                  );
                  const rects = planSelectionRects(
                    lineRects,
                    selectionSpansBlocks(selection.$from, selection.$to),
                    containerRect.left,
                    containerRect.right,
                  );
                  if (rects.length === 0) {
                    hideSelectionEls();
                    return;
                  }
                  paintSelection(rects, containerRect);
                } catch {
                  hideSelectionEls();
                }
                return;
              }

              // Collapsed cursor -> caret is edit-only.
              hideSelectionEls();
              if (!editMode || !editorView.hasFocus()) {
                caretEl.style.display = "none";
                stopBlinkTimer();
                return;
              }

              caretEl.style.display = "block";
              pauseBlink();
              scheduleBlink();

              try {
                const coords = editorView.coordsAtPos(selection.from);
                const left = coords.left - containerRect.left;
                const top = coords.top - containerRect.top;
                const height = coords.bottom - coords.top;

                caretEl.style.transform = `translate3d(${left}px, ${top}px, 0)`;
                caretEl.style.height = `${height}px`;
              } catch {
                caretEl.style.display = "none";
              }
            },
            destroy() {
              unsubscribeTheme();
              stopBlinkTimer();
              caretEl.remove();
              for (const slot of slots) slot.el.remove();
            },
          };
        },
      }),
    ];
  },
});

/** Re-export the PluginKey so consumers (tests, debug tooling)
 *  can read the latest plugin without poking at private plugin
 *  specs. */
// eslint-disable-next-line react-refresh/only-export-components
export const caretAnimationKey = KEY;

// Keep the type import live so tsc doesn't complain even though
// `Transaction` isn't referenced directly any more.
export type { Transaction };
