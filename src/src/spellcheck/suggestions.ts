// Looks up the misspelled word a right-click landed on.

import type { Editor } from "@tiptap/core";
import { SPELLCHECK_PLUGIN_KEY } from "./SpellcheckExtension";

export interface MisspelledWord {
  from: number;
  to: number;
  word: string;
}

/**
 * The decorated word at `pos`, or null when the click missed one.
 * `pos` is a ProseMirror document position, not a DOM offset.
 */
export function findMisspelledWordAtPos(
  editor: Editor,
  pos: number,
): MisspelledWord | null {
  if (editor.isDestroyed) return null;
  const state = SPELLCHECK_PLUGIN_KEY.getState(editor.state);
  if (!state) return null;

  const size = editor.state.doc.content.size;
  const start = Math.max(0, pos - 1);
  const end = Math.min(size, pos + 1);
  const decorations = state.decorations.find(start, end);
  const hit =
    decorations.find(
      (decoration) => decoration.from <= pos && pos <= decoration.to,
    ) ?? decorations[0];
  if (!hit) return null;

  const word =
    typeof hit.spec.word === "string"
      ? hit.spec.word
      : editor.state.doc.textBetween(hit.from, hit.to, " ");
  if (!word) return null;

  return { from: hit.from, to: hit.to, word };
}

/** Resolve a viewport point to a document position without throwing. */
export function documentPosAtCoords(
  editor: Editor,
  coords: { x: number; y: number },
): number | null {
  try {
    const found = editor.view.posAtCoords({ left: coords.x, top: coords.y });
    return found ? found.pos : null;
  } catch {
    return null;
  }
}