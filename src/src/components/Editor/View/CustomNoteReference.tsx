import { ReactNodeViewRenderer } from "@tiptap/react";
import { NoteReference } from "../NoteReference";
import { NoteReferenceNodeView } from "../controllers/NoteReferenceNodeView";

/**
 * Live-editor version of the note-reference node. Split from the
 * schema (`../NoteReference`) so markdown tests can load the node
 * without pulling `@tiptap/react` + MUI into jsdom.
 */
export const CustomNoteReference = NoteReference.extend({
  addNodeView() {
    return ReactNodeViewRenderer(NoteReferenceNodeView);
  },
});

export default CustomNoteReference;
