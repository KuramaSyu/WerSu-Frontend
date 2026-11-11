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
//
// Collaboration: when the live-collab provider is available the same
// animated overlay pool is also fed by remote awareness cursors. Each
// remote client gets its own pool (so their highlights animate
// independently and never steal one another's slots), tinted with
// that user's awareness color. y-prosemirror's static inline
// selection highlight is suppressed (see `selectionRender` in
// NoteEditorCore.hook.tsx) so only the animated overlay shows.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { CellSelection } from "@tiptap/pm/tables";
import * as Y from "yjs";
import * as YTiptap from "@tiptap/y-tiptap";
import type { Awareness } from "y-protocols/awareness";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useThemeStore } from "../../zustand/useThemeStore";
import { alpha } from "@mui/material/styles";
import {
  assignRectsToSlots,
  computeCellSelectionRect,
  planSelectionRects,
  selectionSpansBlocks,
  withCollaborationCaretsHidden,
  type SelectionRect,
} from "./CaretAnimation.helpers";

export interface CaretAnimationOptions {
  /** Disable the overlay entirely. The extension always reads
   *  `useEditorSettings.editMode` on every decoration rebuild, so
   *  the overlay is hidden in read mode without rebuilding the
   *  editor even when `enabled` is `true`. */
  enabled?: boolean;
  /** Awareness store for the live-collab session. When provided,
   *  remote collaborators' selections are painted with the same
   *  animated overlay technique as the local selection. Pass the
   *  dummy provider's awareness in read-only mode (no remote states
   *  means no overlaid selections). */
  awareness?: Awareness | null;
}

// y-tiptap exposes `ySyncPluginKey` at runtime but omits it from its
// public type surface. Reach it through a typed cast; the state it
// holds carries the Y.XmlFragment and the relative-position mapping
// we need to turn awareness cursors into ProseMirror positions.
const ySyncPluginKey = (
  YTiptap as unknown as { ySyncPluginKey: PluginKey }
).ySyncPluginKey;

interface SyncStateLike {
  doc: Y.Doc | null;
  type: Y.XmlFragment | null;
  binding: { mapping: unknown } | null;
}

function getSyncState(state: EditorState): SyncStateLike | null {
  const syncState = ySyncPluginKey.getState(state) as SyncStateLike | undefined;
  return syncState ?? null;
}

const KEY = new PluginKey("caret-animation");

const CARET_CLASS = "pm-animated-caret";
const BLINK_CLASS = "pm-animated-caret--blinking";
const SELECTION_CLASS = "pm-animated-selection";

/** Idle ms before the caret starts blinking again. Matches
 *  Chrome's ~530ms half-period. */
const BLINK_IDLE_MS = 530;

/** Opacity of a remote collaborator's selection highlight. Slightly
 *  stronger than the local hover tint so remote selections stay
 *  legible against busy content. */
const REMOTE_SELECTION_ALPHA = 0.35;

/** Fallback when an awareness entry has no usable color; matches
 *  y-prosemirror's own default. */
const DEFAULT_USER_COLOR = "#ffa500";

function createCaretElement(): HTMLElement {
  const caretEl = document.createElement("div");
  caretEl.className = CARET_CLASS;
  return caretEl;
}

function createSelectionElement(): HTMLElement {
  const selectionEl = document.createElement("div");
  selectionEl.className = SELECTION_CLASS;
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

/** A selection rectangle plus the tint it should be painted with. */
interface PaintedRect extends SelectionRect {
  color: string;
}

/** Per-visual-line client rects of a selection, in viewport
 *  coordinates. Built from the editor positions (rather than
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
  // Hide remote cursor widgets for the measurement: their absolutely
  // positioned name label otherwise leaks into `getClientRects()` and
  // corrupts the cross-block first/middle/last shape (see the helper).
  return withCollaborationCaretsHidden(view.dom, () =>
    Array.from(range.getClientRects())
      .map((r) => ({
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      }))
      .filter((r) => r.right - r.left > 0 && r.bottom - r.top > 0),
  );
}

export const CaretAnimation = Extension.create<CaretAnimationOptions>({
  name: "caretAnimation",

  addOptions() {
    return { enabled: true, awareness: null };
  },

  addProseMirrorPlugins() {
    const awareness = this.options.awareness ?? null;

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
          interface Pool {
            paint(rects: PaintedRect[], containerRect: DOMRect): void;
            hide(): void;
            destroy(): void;
          }
          const createPool = (): Pool => {
            const slots: Slot[] = [];
            const createSlot = (): Slot => {
              const el = createSelectionElement();
              container.appendChild(el);
              const slot = { el, rect: null };
              slots.push(slot);
              return slot;
            };
            const hide = () => {
              for (const slot of slots) {
                slot.el.style.display = "none";
                slot.rect = null;
              }
            };
            const paint = (rects: PaintedRect[], containerRect: DOMRect) => {
              const slotOf = assignRectsToSlots(
                slots.map((slot) => slot.rect),
                rects,
              );
              const assignments: (PaintedRect | null)[] = slots.map(
                () => null,
              );
              for (let i = 0; i < rects.length; i++) {
                let slot = slotOf[i];
                if (slot === -1) {
                  createSlot();
                  slot = slots.length - 1;
                }
                assignments[slot] = rects[i];
              }
              for (let i = 0; i < slots.length; i++) {
                const rect = assignments[i];
                if (rect) {
                  positionRect(slots[i].el, rect, containerRect);
                  slots[i].el.style.backgroundColor = rect.color;
                  slots[i].el.style.display = "block";
                  slots[i].rect = rect;
                } else {
                  slots[i].el.style.display = "none";
                  slots[i].rect = null;
                }
              }
            };
            const destroy = () => {
              for (const slot of slots) slot.el.remove();
            };
            return { paint, hide, destroy };
          };

          // Local selection uses a single shared pool; each remote
          // collaborator gets its own so their animations are
          // independent of each other and of the local highlight.
          const localPool = createPool();
          const remotePools = new Map<number, Pool>();
          const hideLocalSelection = () => localPool.hide();

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

          /** Rectangles for one remote awareness cursor, in viewport
           *  coordinates, or an empty list when it can't be resolved
           *  (cursor outside the mapped range, snapshot active, ...). */
          const computeRemoteRects = (
            view: EditorView,
            state: { cursor?: { anchor: unknown; head: unknown } } | null,
            color: string,
            containerRect: DOMRect,
          ): PaintedRect[] => {
            const ystate = getSyncState(view.state);
            if (
              !state?.cursor ||
              !ystate?.doc ||
              !ystate.type ||
              !ystate.binding
            ) {
              return [];
            }
            const { anchor, head } = state.cursor;
            let from: number | null;
            let to: number | null;
            try {
              from = YTiptap.relativePositionToAbsolutePosition(
                ystate.doc,
                ystate.type,
                Y.createRelativePositionFromJSON(anchor),
                ystate.binding.mapping as never,
              );
              to = YTiptap.relativePositionToAbsolutePosition(
                ystate.doc,
                ystate.type,
                Y.createRelativePositionFromJSON(head),
                ystate.binding.mapping as never,
              );
            } catch {
              return [];
            }
            if (from === null || to === null) return [];

            const docSize = view.state.doc.content.size;
            const start = Math.max(0, Math.min(from, to, docSize));
            const end = Math.max(0, Math.min(Math.max(from, to), docSize));
            if (end <= start) return [];

            try {
              const lineRects = getSelectionLineRects(view, start, end);
              const rects = planSelectionRects(
                lineRects,
                selectionSpansBlocks(
                  view.state.doc.resolve(start),
                  view.state.doc.resolve(end),
                ),
                containerRect.left,
                containerRect.right,
              );
              const tint = alpha(color, REMOTE_SELECTION_ALPHA);
              return rects.map((rect) => ({ ...rect, color: tint }));
            } catch {
              return [];
            }
          };

          /** Repaint every remote collaborator's selection and hide
           *  the pools of users that no longer have one. */
          const paintRemoteSelections = (
            view: EditorView,
            containerRect: DOMRect,
          ) => {
            if (!awareness) {
              for (const pool of remotePools.values()) pool.hide();
              return;
            }
            const active = new Set<number>();
            for (const [clientId, state] of awareness.getStates()) {
              if (clientId === awareness.clientID) continue;
              const userColor =
                typeof state?.user?.color === "string"
                  ? state.user.color
                  : DEFAULT_USER_COLOR;
              const rects = computeRemoteRects(
                view,
                state as { cursor?: { anchor: unknown; head: unknown } } | null,
                userColor,
                containerRect,
              );
              if (rects.length === 0) continue;
              active.add(clientId);
              let pool = remotePools.get(clientId);
              if (!pool) {
                pool = createPool();
                remotePools.set(clientId, pool);
              }
              pool.paint(rects, containerRect);
            }
            for (const [clientId, pool] of remotePools) {
              if (!active.has(clientId)) pool.hide();
            }
          };

          const update = (view: EditorView) => {
            const editMode = useEditorSettings.getState().editMode;
            const { selection } = view.state;
            const containerRect = container.getBoundingClientRect();

            // Remote cursors are independent of the local selection,
            // so paint them first and unconditionally.
            paintRemoteSelections(view, containerRect);

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
                  hideLocalSelection();
                  return;
                }
                localPool.paint(
                  [{ ...rect, color: computeHoverBg() }],
                  containerRect,
                );
              } catch {
                hideLocalSelection();
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
              hideLocalSelection();
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
                  hideLocalSelection();
                  return;
                }
                const tint = computeHoverBg();
                localPool.paint(
                  rects.map((rect) => ({ ...rect, color: tint })),
                  containerRect,
                );
              } catch {
                hideLocalSelection();
              }
              return;
            }

            // Collapsed cursor -> caret is edit-only.
            hideLocalSelection();
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
          };

          const repaint = () => update(editorView);

          // Awareness updates arrive outside ProseMirror's transaction
          // loop (a peer moves their cursor), so listen directly and
          // coalesce repaints into one animation frame. This also
          // covers the case where a remote cursor is already in the
          // awareness state on mount, before any transaction fires.
          let rafId: number | null = null;
          const scheduleRepaint = () => {
            if (rafId !== null) return;
            if (typeof requestAnimationFrame !== "function") {
              repaint();
              return;
            }
            rafId = requestAnimationFrame(() => {
              rafId = null;
              repaint();
            });
          };
          const onAwarenessChange = () => scheduleRepaint();
          awareness?.on("change", onAwarenessChange);
          scheduleRepaint();

          // Theme changes live outside ProseMirror, so repaint so the
          // local tint follows the active theme.
          const unsubscribeTheme = useThemeStore.subscribe(() => repaint());

          return {
            update,
            destroy() {
              if (rafId !== null && typeof cancelAnimationFrame === "function") {
                cancelAnimationFrame(rafId);
              }
              awareness?.off("change", onAwarenessChange);
              unsubscribeTheme();
              stopBlinkTimer();
              caretEl.remove();
              localPool.destroy();
              for (const pool of remotePools.values()) pool.destroy();
              remotePools.clear();
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
