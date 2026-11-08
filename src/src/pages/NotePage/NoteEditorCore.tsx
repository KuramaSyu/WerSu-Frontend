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
import { alpha, getOverlayAlpha } from "@mui/material/styles";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import type { Note } from "../../api/models/search";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useDraftStore } from "../../zustand/useDraftStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useThemeBackgroundStore } from "../../zustand/useThemeBackgroundStore";
import { FeatureFlagName, useFeatureStore } from "../../zustand/FeatureStore";
import { useAppearanceSettings } from "../../zustand/useAppearanceSettings";
import { useUpdateNote } from "../../api/queries/useNoteQueries";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useLayout } from "../../LayoutProvider";
import { M2, M3 } from "../../statics";
import { getNoteEditorWidths } from "./Panel/noteWidthMode";
import { DialogProvider } from "./InputDialog";
import { LiveUsersBridge } from "./LiveUsersBridge";
import { CollabStatusBridge } from "./CollabStatusBridge";
import { MenuVisibilityBridge } from "../../components/Editor/MenuVisibilityBridge";
import { InsertSpeedDial } from "./SpeedDial";
import { AttachmentPreviewModal } from "../../components/Editor/controllers/AttachmentPreviewModal";
import { imageLinkToBlock } from "./editorFormatUtils";
import { useNoteEditor } from "./NoteEditorCore.hook";
import { OutlineBridge } from "./OutlineBridge";
import { NoteStatsBridge } from "./NoteStatsBridge";
import { DraftTrackerBridge } from "./DraftTrackerBridge";
import { CollabSyncBridge } from "./CollabSyncBridge";
import { LatexDialogController } from "./LatexDialogController";
import { FileUploadDialogController } from "./FileUploadDialogController";
import { NoteTitleBar } from "./NoteTitleBar";
import { NoteRichEditor } from "./NoteRichEditor";
import { FindReplaceBar } from "./FindReplaceBar";
import {
  NoteSourceEditor,
  type NoteSourceEditorHandle,
} from "./NoteSourceEditor";
import { useEditorSlashCommands } from "./EditorSlashCommands.hook";
import { type LatexDialogOpenParams } from "./LatexDialogController.utils";
import type { EditorContextMenuOpener } from "../../components/RightClick/EditorRightClickMenu";
import { logRerender } from "./editorRenderLog";
import { CollabConflictController } from "./CollabConflictController";
import { HoldKeyActionBar } from "../../components/HoldKeyActionBar";
import { useEditorModeShortcuts } from "./Panel/useEditorModeShortcuts";
import { useNoteWidthMode } from "./Panel/useNoteWidthMode";
import { useEditorBackdropBlurImage } from "./useEditorBackdropBlurImage";

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
  const seedSourceMarkdown = useActiveNoteStore((s) => s.seedSourceMarkdown);

  const viewMode = useEditorSettings((s) => s.viewMode);
  const editMode = useEditorSettings((s) => s.editMode);
  const widthMode = useViewConfig((s) => s.config.widthMode);
  const readOnly = useViewConfig((s) => s.config.readOnly);

  const { mutateAsync: updateNote } = useUpdateNote();
  const { isMobile } = useBreakpoint();
  const { leftPanelOpen, leftPanelUserOverride, setLeftPanelOpen } =
    useLayout();
  const { theme } = useThemeStore();
  const noteEditorBackgroundBlur = useFeatureStore(
    (s) => s.flags[FeatureFlagName.NoteEditorBackgroundBlur],
  );
  const flatLayout = useFeatureStore(
    (s) => s.flags[FeatureFlagName.FlatLayout],
  );
  const { noteEditorBackgroundBlurAmount } = useAppearanceSettings();
  const themeHasBackgroundImage =
    Boolean(theme.custom.chosenBackgroundImage) ||
    theme.custom.backgroundImages.length > 0;
  const showBackgroundBlur =
    noteEditorBackgroundBlur &&
    themeHasBackgroundImage &&
    noteEditorBackgroundBlurAmount > 0;
  // Match the tint that AppShell's elevation-1 TranslucentPaper applies
  // to the main surface (50% alpha). The backdrop copy is blurred image
  // + this uniform tint, which is the same composite the old
  // backdrop-filter sampled from the layers behind the card.
  const backdropTint = alpha(
    flatLayout
      ? theme.palette.background.default
      : theme.palette.background.paper,
    0.5,
  );
  // MUI's elevation variant paints a white overlay on Paper in dark mode.
  // The frosted layer sits on top of the Paper background, so that overlay
  // has to be reproduced explicitly here; otherwise the card loses its
  // paper tint.
  const paperOverlayTint =
    theme.palette.mode === "dark"
      ? alpha("#fff", getOverlayAlpha(1))
      : null;
  const backdropOverlays = [
    paperOverlayTint !== null
      ? `linear-gradient(${paperOverlayTint}, ${paperOverlayTint})`
      : null,
    `linear-gradient(${backdropTint}, ${backdropTint})`,
  ]
    .filter((layer): layer is string => layer !== null)
    .join(", ");
  // Bake the extra blur once. Moving the card during scrolling or the
  // top-bar hide/reveal animation then only repaints a static image instead
  // of re-running a blur shader every frame.
  const editorBackdrop = useEditorBackdropBlurImage(
    showBackgroundBlur,
    noteEditorBackgroundBlurAmount,
  );
  // The baked image is async (and can fail on browsers without canvas WebP
  // encoding). Keep the old filter-based layer as an immediate fallback so
  // the card is never sharp while generation runs.
  const backgroundSource = useThemeBackgroundStore((s) => s.resolvedUrl);
  const forceFullWidth = isMobile;
  const { body: editorWidth, paper: paperWidth } = getNoteEditorWidths(
    widthMode,
    forceFullWidth,
  );

  // Stable ref the math extension's onClick and slash commands call
  // into. LatexDialogController updates it on every render.
  const latexOpenerRef = useRef<
    ((params: LatexDialogOpenParams) => void) | null
  >(null);

  // Stable ref the editor's contextmenu handler calls into. Kept
  // pointed at a live handler by EditorRightClickMenu (rendered in
  // NoteRichEditor) so the editor config never rebuilds.
  const contextMenuOpenerRef = useRef<EditorContextMenuOpener | null>(null);

  const sourceEditorRef = useRef<NoteSourceEditorHandle | null>(null);

  // User-facing setters that also flag the note as a draft. The seed
  // effects below deliberately keep calling the raw store setters, so
  // merely opening a note never creates a draft on its own.
  const setTitleFromUser = useCallback(
    (nextTitle: string) => {
      // Read the previous value before writing so we can record the
      // magnitude of the edit (length delta is a cheap proxy).
      const previous = useActiveNoteStore.getState().title;
      setTitle(nextTitle);
      if (noteId) {
        useDraftStore.getState().markDraft(noteId, {
          changedChars: Math.abs(nextTitle.length - previous.length),
        });
      }
    },
    [setTitle, noteId],
  );

  const setSourceMarkdownFromUser = useCallback(
    (markdown: string) => {
      const previous = useActiveNoteStore.getState().sourceMarkdown;
      setSourceMarkdown(markdown);
      if (noteId) {
        useDraftStore.getState().markDraft(noteId, {
          changedChars: Math.abs(markdown.length - previous.length),
        });
      }
    },
    [setSourceMarkdown, noteId],
  );

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
      // Use the seed setter: it mirrors the source buffer without
      // marking the markdown as already-written, so the seed effect in
      // `useNoteEditor` still loads it into the editor. This matters on
      // a cache miss, where the note resolves *after* the editor has
      // mounted and the editor's `setEditor` reset has already run.
      seedSourceMarkdown(note.content || note.stripped_content || "");
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
      setSourceMarkdownFromUser(newValue);
    },
    [viewMode, sourceMarkdown, setSourceMarkdownFromUser],
  );

  // Hold-to-run editor shortcuts (shared with the right-rail
  // Shortcuts panel). The floating bar is the visible feedback. The
  // width shortcuts reuse the toolbar's transition controller so
  // entering/leaving `full` moves the side panels the same way.
  const { setWidthMode } = useNoteWidthMode();
  const { actions: holdShortcuts } = useEditorModeShortcuts({ setWidthMode });

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
    contextMenuOpenerRef,
  });

  return (
    <>
      <Paper
        // AppShell already provides the page card surface; the editor
        // sits on top with elevation 0 so it does not double-card.
        elevation={1}
        sx={{
          // The frosted layer below is absolutely positioned relative to
          // this card.
          position: "relative",
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
          width: paperWidth,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {showBackgroundBlur && editorBackdrop && (
          // Keep the blurred backdrop itself stationary in the viewport and
          // clip it to the moving card. Moving / resizing the card then only
          // changes a cheap clip path instead of repainting the backdrop.
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              clipPath: (t) =>
                `inset(0 round ${String(Number(t.shape.borderRadius) * 2)}px)`,
            }}
          >
            <Box
              data-testid="note-editor-backdrop-blur"
              sx={{
                position: "fixed",
                inset: 0,
                backgroundImage: `${backdropOverlays}, url("${editorBackdrop.url}")`,
                backgroundSize: `${String(editorBackdrop.width)}px ${String(editorBackdrop.height)}px`,
                backgroundPosition: `${String(-editorBackdrop.offsetX)}px ${String(-editorBackdrop.offsetY)}px`,
                backgroundRepeat: "no-repeat",
              }}
            />
          </Box>
        )}
        {showBackgroundBlur && !editorBackdrop && backgroundSource && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              clipPath: (t) =>
                `inset(0 round ${String(Number(t.shape.borderRadius) * 2)}px)`,
            }}
          >
            <Box
              data-testid="note-editor-backdrop-blur-fallback"
              sx={{
                position: "fixed",
                inset: 0,
                backgroundImage: `${backdropOverlays}, url("${backgroundSource}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: `blur(${noteEditorBackgroundBlurAmount}px)`,
              }}
            />
          </Box>
        )}
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
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
            setTitle={setTitleFromUser}
            forceFullWidth={forceFullWidth}
          />

          {editor && viewMode === "rich" && (
            <NoteRichEditor
              editor={editor}
              editMode={editMode}
              editorWidth={editorWidth}
              extraCommands={slashCommands}
              contextMenuOpenerRef={contextMenuOpenerRef}
            />
          )}

          {viewMode === "source" && (
            <NoteSourceEditor
              ref={sourceEditorRef}
              sourceMarkdown={sourceMarkdown}
              setSourceMarkdown={setSourceMarkdownFromUser}
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
        setSourceMarkdown={setSourceMarkdownFromUser}
        sourceMarkdown={sourceMarkdown}
      />

      {/* VS Code-style find/replace. Mounted even when closed so it can
          capture Ctrl/Cmd+F before the browser's native find UI. */}
      <FindReplaceBar
        editor={editor}
        viewMode={viewMode}
        editMode={editMode}
        readOnly={readOnly}
        sourceMarkdown={sourceMarkdown}
        setSourceMarkdown={setSourceMarkdownFromUser}
      />

      {/* Hold-to-run editor shortcuts; the right rail lists them. */}
      <HoldKeyActionBar
        active={holdShortcuts.length > 0}
        capture={false}
        actions={holdShortcuts}
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
      <NoteStatsBridge editor={editor} ydoc={ydoc} />
      <DraftTrackerBridge editor={editor} noteId={noteId} />
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
