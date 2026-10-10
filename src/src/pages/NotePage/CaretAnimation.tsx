// CaretAnimation
// Tiptap extension that swaps the browser-native caret for a smooth
// sliding overlay. The overlay is a sibling DOM element appended to
// the editor container; `view.coordsAtPos` drives a
// `transform: translate3d(...)` on every plugin update, and the
// global stylesheet owns the transition so the browser reliably
// interpolates each change. A companion selection overlay renders
// over an active text selection, replacing the browser's
// `::selection` highlight. `caret-color: transparent` on
// `.ProseMirror` hides the native caret (see tiptap.css).

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useThemeStore } from "../../zustand/useThemeStore";
import { alpha } from "@mui/material/styles";

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

export const CaretAnimation = Extension.create<CaretAnimationOptions>({
  name: "caretAnimation",

  addOptions() {
    return { enabled: true };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: KEY,

        props: {
          decorations(state: EditorState) {
            const editMode = useEditorSettings.getState().editMode;
            if (!editMode) return null;
            return null;
          },
        },

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
          const selectionEl = createSelectionElement(computeHoverBg());
          const container = editorView.dom.parentNode as HTMLElement | null;
          if (!container) {
            return {
              destroy() {
                caretEl.remove();
                selectionEl.remove();
              },
            };
          }
          container.appendChild(caretEl);
          container.appendChild(selectionEl);

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
            selectionEl.style.backgroundColor = computeHoverBg();
          });

          return {
            update(view) {
              const editMode = useEditorSettings.getState().editMode;
              if (!editMode || !editorView.hasFocus()) {
                caretEl.style.display = "none";
                selectionEl.style.display = "none";
                stopBlinkTimer();
                return;
              }

              const { selection } = view.state;
              const containerRect = container.getBoundingClientRect();

              // Active text selection -> hide caret, show a single
              // full-width block spanning every selected line. Block
              // style means partial text outside the selection on the
              // first / last line is also highlighted, which matches
              // the editor's intended visual.
              if (!selection.empty) {
                caretEl.style.display = "none";
                stopBlinkTimer();
                selectionEl.style.display = "block";

                try {
                  const startCoords = editorView.coordsAtPos(selection.from);
                  const endCoords = editorView.coordsAtPos(selection.to);
                  // A small threshold absorbs sub-pixel jitter from
                  // `coordsAtPos` so same-line selections don't get
                  // mis-classified as multi-line.
                  const isMultiLine =
                    Math.abs(startCoords.top - endCoords.top) > 1;

                  if (isMultiLine) {
                    // Multi-line: full-width block spanning every
                    // selected line, anchored to the container so
                    // the CSS transition smoothly interpolates
                    // width/height/transform on each selection tick.
                    const top = Math.min(startCoords.top, endCoords.top);
                    const bottom = Math.max(
                      startCoords.bottom,
                      endCoords.bottom,
                    );
                    selectionEl.style.transform = `translate3d(0, ${
                      top - containerRect.top
                    }px, 0)`;
                    selectionEl.style.width = `${containerRect.width}px`;
                    selectionEl.style.height = `${bottom - top}px`;
                  } else {
                    // Single-line: rect tightly bounding the actual
                    // characters, same as the caret would.
                    const left = Math.min(startCoords.left, endCoords.left);
                    const top = Math.min(startCoords.top, endCoords.top);
                    const right = Math.max(startCoords.right, endCoords.right);
                    const bottom = Math.max(
                      startCoords.bottom,
                      endCoords.bottom,
                    );
                    selectionEl.style.transform = `translate3d(${
                      left - containerRect.left
                    }px, ${top - containerRect.top}px, 0)`;
                    selectionEl.style.width = `${right - left}px`;
                    selectionEl.style.height = `${bottom - top}px`;
                  }
                } catch {
                  selectionEl.style.display = "none";
                }
                return;
              }

              // Collapsed cursor -> hide selection, show caret with blink.
              selectionEl.style.display = "none";
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
              selectionEl.remove();
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
