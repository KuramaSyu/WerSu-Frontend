import { create } from "zustand";
import type { Note } from "../api/models/search";
import type { Editor } from "@tiptap/core";
import { useEditorSettings } from "./useEditorSettings";
import { markdownToProsemirror } from "../pages/NotePage/Editor";
import { NoteApi } from "../api/NoteApi";
import { queryClient } from "../api/queryClient";
import useInfoStore, { SnackbarUpdateImpl } from "./InfoStore";

interface ActiveNoteState {
  noteId: string | undefined;

  /* re-renders only when the editor object ref changes. not when state changes within happen */
  editor: Editor | null;

  title: string;
  sourceMarkdown: string;
  isSaving: boolean;
  onNoteUpdated: ((note: Note) => void) | null;

  /* function to actually store a note. should be used to inject a tanstack mutation function */
  updateNote: (title: string, content: string) => Promise<Note>;

  registerNote: (
    noteId: string | undefined,
    onNoteUpdated: (note: Note) => void,
  ) => void;

  // setEditor(null) for cleanup
  setEditor: (editor: Editor | null) => void;
  setTitle: (title: string) => void;
  setSourceMarkdown: (markdown: string) => void;

  /**
   * setter for updateNote. Use it to inject a tanstack mutation function, so that updates/invalidation can be handled proerly
   */
  setUpdateNoteFn: (
    fn: (title: string, content: string) => Promise<Note>,
  ) => void;

  getContent: () => string;
  setContent: (markdown: string) => void;
  save: (titleOverrdide?: string, contentOverride?: string) => Promise<void>;
}

export const useActiveNoteStore = create<ActiveNoteState>((set, get) => ({
  noteId: undefined,
  editor: null,
  title: "",
  sourceMarkdown: "",
  isSaving: false,
  onNoteUpdated: null,
  updateNote: (title: string, content: string) => {
    throw new Error("updateNote function not set");
  },

  registerNote: (noteId, onNoteUpdated) => set({ noteId, onNoteUpdated }),
  setEditor: (editor) => set({ editor }),
  setTitle: (title) => set({ title }),
  setSourceMarkdown: (markdown) => set({ sourceMarkdown: markdown }),
  setUpdateNoteFn: (fn) => set({ updateNote: fn }),

  getContent: () => {
    const { editMode, viewMode } = useEditorSettings.getState();
    const { editor, sourceMarkdown } = get();
    // parse this markdown from editor
    return viewMode === "source"
      ? sourceMarkdown
      : (editor?.getMarkdown() ?? "");
  },

  setContent: (markdown) => {
    const { viewMode } = useEditorSettings.getState();

    // if we are in markdown source mode, just set the content into the sourceMarkdown state
    if (viewMode === "source") {
      set({ sourceMarkdown: markdown });
      return;
    }

    // we are in the rich text editor
    const editor = get().editor;
    if (!editor) return;
    // normalize doc to prevent table errors
    const normalizedDoc = markdownToProsemirror(editor, markdown);
    // start microtask to prevent flush error
    queueMicrotask(() => editor.commands.setContent(normalizedDoc));
  },

  save: async (titleOverride, contentOverride) => {
    const { noteId, title, onNoteUpdated, setContent } = get();
    if (!noteId) return;

    if (titleOverride !== undefined) set({ title: titleOverride });
    if (contentOverride !== undefined) setContent(contentOverride);

    const finalTitle = titleOverride ?? title;
    const finalContent = contentOverride ?? get().getContent();

    set({ isSaving: true });
    try {
      const saved = await get().updateNote(finalTitle, finalContent);
      onNoteUpdated?.(saved); // call hook
      set({ title: finalTitle });
      useInfoStore
        .getState()
        .setMessage(new SnackbarUpdateImpl("Note saved", "success"));
    } catch (error) {
      useInfoStore
        .getState()
        .setMessage(new SnackbarUpdateImpl("Failed to save note", "error"));
    } finally {
      set({ isSaving: false });
    }
  },
}));
