import { create } from "zustand";
import * as Y from "yjs";
import type { Note } from "../api/models/search";
import type { Editor } from "@tiptap/core";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import { useEditorSettings } from "./useEditorSettings";
import { markdownToProsemirror } from "../utils/converters/toProsemirror/markdownToProsemirror";
import {
  composeNoteContent,
  findNoteHeaderImage,
  stripNoteHeaderImage,
} from "../utils/headerImage";
import { logContentSet, logCollabContent } from "../hooks/collabContentLog";
import { NoteApi } from "../api/NoteApi";
import { queryClient } from "../api/queryClient";
import useInfoStore, { SnackbarUpdateImpl } from "./InfoStore";
import { useDraftStore } from "./useDraftStore";

interface ActiveNoteState {
  noteId: string | undefined;

  /* re-renders only when the editor object ref changes. not when state changes within happen */
  editor: Editor | null;

  /** Y.Doc backing the editor when Collaboration is active. NoteEditorCore registers this on mount. */
  ydoc: Y.Doc | null;

  title: string;
  sourceMarkdown: string;
  /**
   * Inline Markdown for the note's `HeaderImage` (`![HeaderImage](url)`).
   * The source buffer keeps the full document (header included); this
   * field is what the rich editor strips out and what `getContent`
   * re-attaches when serialising.
   */
  headerImageMarkdown: string | null;
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
  setHeaderImageMarkdown: (markdown: string | null) => void;

  /**
   * Mirrors a note's markdown into the source buffer *without* claiming
   * that it was already written to the editor. Used by the note-load
   * effect so the read-mode `setContent` seed is not deduped away when
   * the note resolves after the editor was already mounted (cache miss).
   */
  seedSourceMarkdown: (markdown: string) => void;

  /** Setter for updateNote; injects a tanstack mutation function so updates/invalidation work. */
  setUpdateNoteFn: (
    fn: (title: string, content: string) => Promise<Note>,
  ) => void;

  getContent: () => string;
  /** Editor body with the note's header image re-attached. */
  getContentWithHeader: () => string;
  /**
   * Writes `markdown` into the rich editor (and mirrors it into the
   * source buffer). Normally a no-op when `markdown` matches what was
   * last written, which guards against the Collaboration onSynced echo.
   * Pass `force` for explicit user intents (leaving source mode, a save
   * with an override) where the editor must be updated even though the
   * source buffer already claims that markdown.
   */
  setContent: (markdown: string, force?: boolean) => void;
  /**
   * Replaces the editor content with `markdown` without saving it.
   *
   * Unlike `setContent`, this always rewrites the *whole* document.
   * The version preview needs that: `setContent`'s Y.Doc fast path
   * uses `prosemirrorJSONToYXmlFragment` with a fresh mapping, which
   * diffs against the existing fragment and can leave parts of the
   * previous note in place. Clearing the fragment first makes the
   * write a plain insert, so the restored version always lands in
   * full. No save/PATCH and no version is created here.
   */
  replaceContent: (markdown: string) => void;
  save: (titleOverrdide?: string, contentOverride?: string) => Promise<void>;
}

// Transaction origin for a version preview write. Anything other than
// ySyncPluginKey is treated as a remote change by y-prosemirror, which
// renders the whole fragment back into the editor.
const VERSION_PREVIEW_ORIGIN = "version-preview";

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
    headerImageMarkdown: null,
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
    setHeaderImageMarkdown: (headerImageMarkdown) =>
      set({ headerImageMarkdown }),
    setSourceMarkdown: (markdown) => {
      // Track the source buffer as the latest known markdown so an
      // unchanged source -> rich toggle is deduped (no needless editor
      // reset). `lastWrittenMarkdown` tracks the *rich* body (header
      // stripped) because that is what the editor actually holds.
      lastWrittenMarkdown = stripNoteHeaderImage(markdown);
      set({
        sourceMarkdown: markdown,
        headerImageMarkdown:
          findNoteHeaderImage(markdown)?.markdown ?? null,
      });
    },
    seedSourceMarkdown: (markdown) => {
      // Deliberately does NOT touch `lastWrittenMarkdown`: the caller
      // still needs `setContent` to run and load the note into the
      // editor.
      set({ sourceMarkdown: markdown });
    },
    setUpdateNoteFn: (fn) => set({ updateNote: fn }),

    getContent: () => {
      const { viewMode } = useEditorSettings.getState();
      const { editor, sourceMarkdown, headerImageMarkdown } = get();
      // Source mode already holds the full document (header included).
      // The rich editor holds only the body, so re-attach the header
      // to keep every consumer (`save`, copy, conflict handling)
      // working with complete Markdown.
      return viewMode === "source"
        ? sourceMarkdown
        : composeNoteContent(editor?.getMarkdown() ?? "", headerImageMarkdown);
    },

    getContentWithHeader: () => get().getContent(),

    setContent: (markdown, force = false) => {
      const _noteId = get().noteId;
      // A silently-skipped write is the one shape of failure the
      // content-set log cannot show, so the guard exits are logged too.
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
          logCollabContent("content-set-skipped(watchdog)", _noteId, {
            markdownLen: (markdown ?? "").length,
          });
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

      // The rich editor never holds the header image line; only the
      // body is written to the Y.Doc / ProseMirror document.
      const editorMarkdown = stripNoteHeaderImage(markdown);

      // Same-content dedupe: guards Collaboration onSynced echo.
      // `force` skips it for explicit user intents (source -> rich),
      // where the source buffer legitimately differs from the editor.
      if (!force && lastWrittenMarkdown === editorMarkdown) {
        // The rich body is unchanged, but the header (or the source
        // buffer) may still have changed. Keep both in sync without
        // touching the editor document.
        set({
          sourceMarkdown: markdown,
          headerImageMarkdown:
            findNoteHeaderImage(markdown)?.markdown ?? null,
        });
        logCollabContent("content-set-skipped(dedupe)", _noteId, {
          markdownLen: (markdown ?? "").length,
          editorBound: !!get().editor,
          ydocBound: !!get().ydoc,
        });
        return;
      }
      lastWrittenMarkdown = editorMarkdown;

      const editor = get().editor;
      const ydoc = get().ydoc;
      const noteId = get().noteId;
      set({
        sourceMarkdown: markdown,
        headerImageMarkdown: findNoteHeaderImage(markdown)?.markdown ?? null,
      });
      if (!editor) {
        logCollabContent("content-set-skipped(no-editor)", noteId, {
          markdownLen: markdown.length,
        });
        return;
      }
      // normalize doc to prevent table errors
      const normalizedDoc = markdownToProsemirror(editor, editorMarkdown);

      // Fast path: diff the bound XmlFragment in place against the new
      // prosemirror doc, avoiding editor.commands.setContent (the source
      // of the flushSync re-render storm).
      if (ydoc) {
        try {
          const fragment = ydoc.getXmlFragment("default");
          prosemirrorJSONToYXmlFragment(editor.schema, normalizedDoc, fragment);
          logContentSet(noteId, editorMarkdown, ydoc, "ydoc-fragment");
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
      logContentSet(noteId, editorMarkdown, ydoc, "editor-cmd");
      queueMicrotask(() => {
        editor.commands.setContent(normalizedDoc);
      });
    },

    replaceContent: (markdown) => {
      const editorMarkdown = stripNoteHeaderImage(markdown);
      lastWrittenMarkdown = editorMarkdown;
      set({
        sourceMarkdown: markdown,
        headerImageMarkdown: findNoteHeaderImage(markdown)?.markdown ?? null,
      });

      const { editor, ydoc, noteId } = get();
      if (!editor) {
        logCollabContent("replace-content-skipped(no-editor)", noteId, {
          markdownLen: markdown.length,
        });
        return;
      }

      const normalizedDoc = markdownToProsemirror(editor, editorMarkdown);

      if (ydoc) {
        const fragment = ydoc.getXmlFragment("default");
        // Clear and rewrite inside a single transaction. The origin is
        // deliberately *not* ySyncPluginKey: y-prosemirror treats any
        // other origin as a remote change and re-renders the editor
        // from the full fragment. In collab mode the provider then
        // syncs the swap like a normal collaborative edit; nothing is
        // explicitly saved and no version is created.
        ydoc.transact(() => {
          if (fragment.length > 0) {
            fragment.delete(0, fragment.length);
          }
          prosemirrorJSONToYXmlFragment(editor.schema, normalizedDoc, fragment);
        }, VERSION_PREVIEW_ORIGIN);
        logContentSet(noteId, editorMarkdown, ydoc, "ydoc-fragment");
        return;
      }

      // Read mode / no bound Y.Doc: replace the ProseMirror document.
      logContentSet(noteId, editorMarkdown, ydoc, "editor-cmd");
      editor.commands.setContent(normalizedDoc);
    },

    save: async (titleOverride, contentOverride) => {
      const { noteId, title, onNoteUpdated, setContent } = get();
      if (!noteId) return;

      if (titleOverride !== undefined) set({ title: titleOverride });
      if (contentOverride !== undefined) setContent(contentOverride, true);

      const finalTitle = titleOverride ?? title;
      // The editor body never contains the header image, so re-attach
      // it here before persisting.
      const finalContent = contentOverride ?? get().getContent();

      set({ isSaving: true });
      try {
        const saved = await get().updateNote(finalTitle, finalContent);
        await onNoteUpdated?.(saved); // call hook
        // The note now matches what is on the server, so it is no longer
        // a draft. Cleared only on success so a failed save keeps the
        // draft visible on Home.
        useDraftStore.getState().clearDraft(noteId);
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
