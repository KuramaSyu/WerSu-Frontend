// Bridges the active note's spell-check preference into the editor.
//
// Mounted once per editor: it disables the browser's native checker
// (which cannot handle a second language), applies the note's
// language to the editable element, and drives the store that the
// decoration plugin and the right-click menu read.

import { useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { useSpellcheckPreference } from "../../hooks/useSpellcheckPreference";
import { useSpellcheckStore } from "../../spellcheck/spellcheckStore";

export interface SpellcheckControllerProps {
  noteId?: string;
  editor: Editor | null;
}

export const SpellcheckController: React.FC<SpellcheckControllerProps> = ({
  noteId,
  editor,
}) => {
  const { preference } = useSpellcheckPreference(noteId);
  const { enabled, language } = preference;

  useEffect(() => {
    useSpellcheckStore.getState().configure({ enabled, language });
  }, [enabled, language]);

  // A different note must not inherit the previous note's underlines.
  useEffect(() => {
    return () => {
      useSpellcheckStore.getState().reset();
    };
  }, [noteId]);

  useEffect(() => {
    if (!editor) return;
    const apply = () => {
      if (editor.isDestroyed) return;
      const dom = editor.view.dom;
      // Native checking is always off: it can only use one dictionary
      // and would duplicate the custom underlines.
      dom.setAttribute("spellcheck", "false");
      dom.setAttribute("lang", language);
    };
    apply();
    editor.on("create", apply);
    return () => {
      editor.off("create", apply);
    };
  }, [editor, language]);

  return null;
};