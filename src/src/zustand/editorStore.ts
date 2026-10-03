import { create } from "zustand";
import * as Y from "yjs";
import type { Note } from "../api/models/search";
import type { Editor } from "@tiptap/core";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import { useEditorSettings } from "./useEditorSettings";
import { markdownToProsemirror } from "../utils/converters/toProsemirror/markdownToProsemirror";
import { NoteApi } from "../api/NoteApi";
import { queryClient } from "../api/queryClient";
import useInfoStore, { SnackbarUpdateImpl } from "./InfoStore";

interface ActiveNoteState {
  noteId: string | undefined;

  /* re-renders only when the editor object ref changes. not when state changes within happen */
  editor: Editor | null;

  /** Y.Doc backing the editor when Collaboration is active. NoteEditorCore registers this on mount. */
  ydoc: Y.Doc | null;

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
  setYDoc: (ydoc: Y.Doc | null) => void;
  setTitle: (title: string) => void;
  setSourceMarkdown: (markdown: string) => void;

  /** Setter for updateNote; injects a tanstack mutation function so updates/invalidation work. */
  setUpdateNoteFn: (
    fn: (title: string, content: string) => Promise<Note>,
  ) => void;

  getContent: () => string;
  setContent: (markdown: string) => void;
  save: (titleOverrdide?: string, contentOverride?: string) => Promise<void>;
}

// Watchdog: trip after N calls in WINDOW_MS, block writes for COOLDOWN_MS.
// 5 s cooldown is short enough to recover quickly yet breaks the feedback loop.
const WATCHDOG_WINDOW_MS = 2_000;
const WATCHDOG_THRESHOLD = 10;
const WATCHDOG_COOLDOWN_MS = 60_000;

export const useActiveNoteStore = create<ActiveNoteState>((set, get) => {
  const callTimestamps: number[] = [];
  let trippedUntil = 0;
  let lastWrittenMarkdown: string | null = null;
  let lastTrippedMarkdown: string | null = null;

  return {
    noteId: undefined,
    editor: null,
    ydoc: null,
    title: "",
    sourceMarkdown: "",
    isSaving: false,
    onNoteUpdated: null,
    updateNote: (title: string, content: string) => {
      throw new Error("updateNote function not set");
    },

    registerNote: (noteId, onNoteUpdated) => set({ noteId, onNoteUpdated }),
    setEditor: (editor) => {
      // Reset watchdog state when the editor instance changes.
      callTimestamps.length = 0;
      trippedUntil = 0;
      lastWrittenMarkdown = null;
      lastTrippedMarkdown = null;
      set({ editor });
    },

    setYDoc: (ydoc) => set({ ydoc }),
    setTitle: (title) => set({ title }),
    setSourceMarkdown: (markdown) => {
      // Keep memo in sync with user source edits so dedupe does not block.
      lastWrittenMarkdown = markdown;
      set({ sourceMarkdown: markdown });
    },
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
      // Log call count + caller stack so we can find the hammering site.
      // Gated: first call + every call once we cross 3 in the window.
      const _traceCount = callTimestamps.length;
      if (_traceCount >= 3 || _traceCount === 0) {
        const _stack = new Error("setContent trace").stack ?? "";
        const _frames = _stack
          .split("\n")
          .slice(1, 5)
          .map((f) => f.trim())
          .join(" | ");
        // eslint-disable-next-line no-console
        console.log(
          `[editor-watchdog] setContent call #${_traceCount + 1} markdownLen=${markdown?.length ?? 0} first80=${(markdown ?? "").slice(0, 80).replace(/\n/g, "\\n")} stack=${_frames}`,
        );
      }

      // Slide the rolling window forward and trip if we are over threshold.
      const now = Date.now();
      callTimestamps.push(now);
      while (
        callTimestamps.length > 0 &&
        now - callTimestamps[0] > WATCHDOG_WINDOW_MS
      ) {
        callTimestamps.shift();
      }

      if (callTimestamps.length >= WATCHDOG_THRESHOLD) {
        // Suppress repeat snackbar/log spam while breaker is open for same markdown.
        if (now < trippedUntil && lastTrippedMarkdown === markdown) {
          set({ sourceMarkdown: markdown });
          return;
        }
        trippedUntil = now + WATCHDOG_COOLDOWN_MS;
        lastTrippedMarkdown = markdown;
        // First differing line pinpoints where the round-trip drift is.
        const prev = lastWrittenMarkdown ?? "";
        const prevLines = prev.split("\n");
        const newLines = (markdown ?? "").split("\n");
        const maxLen = Math.max(prevLines.length, newLines.length);
        let firstChangedLine = -1;
        for (let i = 0; i < maxLen; i += 1) {
          if (prevLines[i] !== newLines[i]) {
            firstChangedLine = i;
            break;
          }
        }
        const where =
          firstChangedLine >= 0
            ? `line ${firstChangedLine + 1}: ${(newLines[firstChangedLine] ?? "").slice(0, 80)}`
            : "no line-level diff (whitespace or attribute drift)";
        const sample = (markdown ?? "").slice(0, 200);
        // Include the caller stack in the trip event too.
        const _tripStack = new Error("setContent trip").stack ?? "";
        const _tripFrames = _tripStack
          .split("\n")
          .slice(1, 6)
          .map((f) => f.trim())
          .join(" | ");
        console.error(
          `[editor-watchdog] setContent tripped: ${callTimestamps.length} calls in ${WATCHDOG_WINDOW_MS}ms. Suspected drift around ${where}. First 200 chars of incoming markdown:\n${sample}\nstack=${_tripFrames}`,
        );
        set({ sourceMarkdown: markdown });
        useInfoStore
          .getState()
          .setMessage(
            new SnackbarUpdateImpl(
              `Editor write blocked: ${callTimestamps.length} updates in ${WATCHDOG_WINDOW_MS}ms tripped the watchdog. Likely cause: markdown to prosemirror round-trip drift around ${where}. Editor write paused for ${Math.round(WATCHDOG_COOLDOWN_MS / 1000)}s.`,
              "error",
            ),
          );
        return;
      }

      // Cooldown elapsed - allow the next write through cleanly.
      if (now >= trippedUntil) {
        trippedUntil = 0;
        lastTrippedMarkdown = null;
      }

      // Same-content dedupe: guards Collaboration onSynced echo.
      if (lastWrittenMarkdown === markdown) {
        return;
      }
      lastWrittenMarkdown = markdown;

      const editor = get().editor;
      const ydoc = get().ydoc;
      set({ sourceMarkdown: markdown });
      if (!editor) return;
      // normalize doc to prevent table errors
      const normalizedDoc = markdownToProsemirror(editor, markdown);

      // Fast path: diff the bound XmlFragment in place against the new
      // prosemirror doc, avoiding editor.commands.setContent (the source
      // of the flushSync re-render storm).
      if (ydoc) {
        try {
          const fragment = ydoc.getXmlFragment("default");
          prosemirrorJSONToYXmlFragment(editor.schema, normalizedDoc, fragment);
          return;
        } catch (err) {
          // Fall through to legacy path if ydoc write fails.
          console.warn(
            "[editor-watchdog] ydoc-direct write failed, falling back to editor.commands.setContent",
            err,
          );
        }
      }

      // Legacy path: read mode (no ydoc bound yet) and ydoc-write fallback.
      // Deferred via queueMicrotask so the round-trip cannot trigger flushSync.
      queueMicrotask(() => {
        editor.commands.setContent(normalizedDoc);
      });
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
        await onNoteUpdated?.(saved); // call hook
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
  };
});
