// ---------------------------------------------------------------------------
// NoteEditorCore
// Pure editor coordinator: renders the Tiptap editor and wires bridges
// to the Yjs document. Does NOT know how the collab session was
// sourced (Editor.tsx picks the hook). ydoc/provider may be null; in
// that case useNoteEditor falls back to a per-mount empty Y.Doc so the
// Tiptap Collaboration extension still has a document to bind to. This
// file is intentionally a thin coordinator; per-keystroke work lives
// in the *.hook.tsx / Bridge.tsx / Controller.tsx siblings.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from "react";
import { Box, Paper, Typography } from "@mui/material";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import type { Note } from "../../api/models/search";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useUpdateNote } from "../../api/queries/useNoteQueries";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useLayout } from "../../LayoutProvider";
import { M2, M3, NOTE_EDITOR_A4_WIDTH } from "../../statics";
import { DialogProvider } from "./InputDialog";
import { LiveUsersBridge } from "./LiveUsersBridge";
import { CollabStatusBridge } from "./CollabStatusBridge";
import { MenuVisibilityBridge } from "../../components/Editor/MenuVisibilityBridge";
import { InsertSpeedDial } from "./SpeedDial";
import { AttachmentPreviewModal } from "../../components/Editor/controllers/AttachmentPreviewModal";
import { imageLinkToBlock } from "./editorFormatUtils";
import { useNoteEditor } from "./NoteEditorCore.hook";
import { OutlineBridge } from "./OutlineBridge";
import { CollabSyncBridge } from "./CollabSyncBridge";
import { LatexDialogController } from "./LatexDialogController";
import { FileUploadDialogController } from "./FileUploadDialogController";
import { NoteTitleBar } from "./NoteTitleBar";
import { NoteRichEditor } from "./NoteRichEditor";
import {
  NoteSourceEditor,
  type NoteSourceEditorHandle,
} from "./NoteSourceEditor";
import { useEditorSlashCommands } from "./EditorSlashCommands.hook";
import { type LatexDialogOpenParams } from "./LatexDialogController.utils";
import { logRerender } from "./editorRenderLog";
import { CollabConflictController } from "./CollabConflictController";

export interface NoteEditorProps {
  note?: Note;
  noteId?: string;
  fetchError: string | null;
  onNoteUpdated: (note: Note) => void;
  /** When true, the editor closes the left rail on mount unless the user explicitly opened it. */
  hideLeftPanel?: boolean;
}

export interface NoteEditorCoreProps extends NoteEditorProps {
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
}

/** Inner component that actually consumes useDialog(). Lives behind a DialogProvider. */
const NoteEditorCoreInner: React.FC<NoteEditorCoreProps> = ({
  note,
  noteId,
  fetchError: _fetchError,
  onNoteUpdated,
  ydoc,
  provider,
  hideLeftPanel,
}) => {
  logRerender("NoteEditorCoreInner", {
    hasNote: !!note,
    hasEditor: false, // see below
    hasYdoc: !!ydoc,
    hasProvider: !!provider,
  });
  // Per-field selectors on the active-note store. Without them a per-
  // keystroke title or source change re-renders the whole tree.
  const title = useActiveNoteStore((s) => s.title);
  const setTitle = useActiveNoteStore((s) => s.setTitle);
  const sourceMarkdown = useActiveNoteStore((s) => s.sourceMarkdown);
  const setSourceMarkdown = useActiveNoteStore((s) => s.setSourceMarkdown);

  const viewMode = useEditorSettings((s) => s.viewMode);
  const editMode = useEditorSettings((s) => s.editMode);
  const a4Width = useViewConfig((s) => s.config.a4Width);

  const { mutateAsync: updateNote } = useUpdateNote();
  const { isMobile } = useBreakpoint();
  const { leftPanelOpen, leftPanelUserOverride, setLeftPanelOpen } =
    useLayout();
  const forceFullWidth = isMobile;
  const editorWidth =
    a4Width && !forceFullWidth ? NOTE_EDITOR_A4_WIDTH : "100%";

  // Stable ref the math extension's onClick and slash commands call
  // into. LatexDialogController updates it on every render.
  const latexOpenerRef = useRef<
    ((params: LatexDialogOpenParams) => void) | null
  >(null);

  const sourceEditorRef = useRef<NoteSourceEditorHandle | null>(null);

  // Honour hideLeftPanel on mount: when the caller asks for the left
  // rail to be hidden, close it unless the user explicitly toggled it.
  useEffect(() => {
    if (!hideLeftPanel) return;
    if (leftPanelUserOverride) return;
    if (leftPanelOpen) {
      setLeftPanelOpen(false);
    }
    // leftPanelUserOverride flips on the next mount and we do not
    // want to re-run when it does; the gate above is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideLeftPanel]);

  // Sync title and source markdown from the loaded note. Guarded by
  // note?.id so a re-render with the same note does not clobber edits.
  useEffect(() => {
    setTitle(note?.title ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  useEffect(() => {
    if (note) {
      setSourceMarkdown(note.content || note.stripped_content || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  // Insertion helper: routes the link to the active surface. Used by
  // the file-upload dialog. Memoized so it does not re-fire per key.
  const insertAtCurrentPosition = useCallback(
    (text: string) => {
      const block = imageLinkToBlock(text, viewMode);
      if (viewMode === "rich") {
        // No-op for non-slash flows; the file dialog's rich-mode path
        // already uses editor.chain().uploadAttachment.
        return;
      }
      const range = sourceEditorRef.current?.getSelectionRange();
      const start = range?.start ?? sourceMarkdown.length;
      const end = range?.end ?? sourceMarkdown.length;
      const newValue =
        sourceMarkdown.substring(0, start) +
        block +
        sourceMarkdown.substring(end);
      setSourceMarkdown(newValue);
    },
    [viewMode, sourceMarkdown, setSourceMarkdown],
  );

  // Memoized slash command list. Without useMemo the array identity
  // changes per render and retriggers BubbleMenu plugin teardown.
  const slashCommands = useEditorSlashCommands({ latexOpenerRef });

  // Build the Tiptap editor. Effects inside the hook mirror the editor
  // refs into the active-note store and sync editMode with isEditable.
  const editor = useNoteEditor({
    noteId,
    ydoc,
    provider,
    note,
    onNoteUpdated,
    updateNote,
    latexOpenerRef,
  });

  return (
    <>
      <Paper
        // AppShell already provides the page card surface; the editor
        // sits on top with elevation 0 so it does not double-card.
        elevation={1}
        sx={{
          backgroundColor: "transparent",
          borderRadius: 2,
          // On mobile the outer Paper has no padding so the editor fills
          // the screen; AppShell's safe-area padding still applies below.
          px: forceFullWidth ? 0 : M3,
          my: forceFullWidth ? 0 : M2,

          mx: "auto",
          transition: (t) =>
            t.transitions.create("width", {
              duration: t.transitions.duration.complex,
            }),
          width:
            a4Width && !forceFullWidth
              ? `calc(${NOTE_EDITOR_A4_WIDTH} + 1rem)`
              : "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            height: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: M3,
          }}
          onClick={(event) => {
            // only focus editor if the paper itself was clicked, not a child
            if (event.target !== event.currentTarget) {
              return;
            }
            editor?.commands.focus("end");
          }}
        >
          <NoteTitleBar
            title={title}
            setTitle={setTitle}
            forceFullWidth={forceFullWidth}
          />

          {editor && viewMode === "rich" && (
            <NoteRichEditor
              editor={editor}
              editMode={editMode}
              editorWidth={editorWidth}
              extraCommands={slashCommands}
            />
          )}

          {viewMode === "source" && (
            <NoteSourceEditor
              ref={sourceEditorRef}
              sourceMarkdown={sourceMarkdown}
              setSourceMarkdown={setSourceMarkdown}
              editorWidth={editorWidth}
            />
          )}

          {!editor && (
            <Typography color="textSecondary">Loading editor...</Typography>
          )}
        </Box>
      </Paper>

      {/* Floating editor actions */}
      <InsertSpeedDial
        editor={editor}
        setSourceMarkdown={setSourceMarkdown}
        sourceMarkdown={sourceMarkdown}
      />

      {/* Imperative dialogs. Each owns its own state and re-renders
          independently of the editor body. */}
      <FileUploadDialogController
        noteId={noteId}
        directoryId={note?.get_dir()}
        editor={editor}
        insertAtCurrentPosition={insertAtCurrentPosition}
      />
      <LatexDialogController editor={editor} triggerRef={latexOpenerRef} />
      <AttachmentPreviewModal />

      {/* Bridges: render nothing, own side-effect subscriptions off
          the per-keystroke render path. */}
      <OutlineBridge editor={editor} />
      <CollabSyncBridge
        editor={editor}
        ydoc={ydoc}
        provider={provider}
        editMode={editMode}
        noteId={noteId}
      />
      <LiveUsersBridge noteId={noteId} provider={provider} enabled={editMode} />
      <CollabStatusBridge
        noteId={noteId}
        provider={provider}
        enabled={editMode}
      />
      {/* Owns editorMenuStore.isTextSelectionMenuOpen off the editor hot path. */}
      <MenuVisibilityBridge
        editor={editor}
        provider={provider}
        enabled={editMode}
      />
      {/* Shows the conflict resolution modal when the collab status
          is `conflict`. Mounted at all times so the modal can pop up
          without a remount. */}
      <CollabConflictController noteId={noteId} />
    </>
  );
};

/** Public entry point: wraps NoteEditorCoreInner in a DialogProvider for useDialog() descendants. */
export const NoteEditorCore: React.FC<NoteEditorCoreProps> = (props) => {
  return (
    <DialogProvider>
      <NoteEditorCoreInner {...props} />
    </DialogProvider>
  );
};

// imageLinkToBlock lives in editorFormatUtils.ts; markdownToProsemirror
// is imported from src/utils/converters/toProsemirror/markdownToProsemirror.
