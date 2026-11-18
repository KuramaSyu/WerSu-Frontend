// Floating editor actions: read/write FAB (or a read-only badge when
// the view is not writable) and source/rich FAB. Save lives in the
// desktop top bar; on mobile (no top bar) leaving write mode prompts
// to save instead.
//
// On mobile the two FABs are not rendered on the canvas; instead they
// register with `useMobileActionsStore` so `MobileBottomBar` shows them
// as compact icon buttons (see `CreateActions` for the same pattern).

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import type { Editor } from "@tiptap/react";
import { M4, MOBILE_BOTTOM_BAR_CLEARANCE } from "../../statics";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import {
  useMobileActionsStore,
  type MobileAction,
} from "../../zustand/useMobileActionsStore";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useViewConfig } from "../../zustand/useViewConfig";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useDraftStore } from "../../zustand/useDraftStore";
import { logRerender } from "./editorRenderLog";
import ArticleIcon from "@mui/icons-material/Article";
import { StateFab, type StateFabState } from "../../components/StateFab";
import { SaveBeforeReadDialog } from "./SaveBeforeReadDialog";

export interface InsertSpeedDialProps {
  editor: Editor | null;
  sourceMarkdown: string;
  setSourceMarkdown: (markdown: string) => void;
}

// States for the read/write toggle. The FAB shows the *current* mode so
// the eye/pencil is never ambiguous, and spells it out on change.
const READ_WRITE_STATES: StateFabState[] = [
  { key: "read", icon: <VisibilityIcon />, text: "Viewing" },
  { key: "edit", icon: <EditIcon />, text: "Editing" },
];

// States for the rich/source toggle.
const SOURCE_STATES: StateFabState[] = [
  { key: "rich", icon: <ArticleIcon />, text: "Rich" },
  { key: "source", icon: <CodeIcon />, text: "Source" },
];

const InsertSpeedDialImpl: React.FC<InsertSpeedDialProps> = ({
  editor,
  sourceMarkdown,
  setSourceMarkdown,
}) => {
  logRerender("InsertSpeedDial", {
    hasEditor: !!editor,
    sourceLen: sourceMarkdown.length,
  });
  const { theme } = useThemeStore();
  const { viewMode, setViewMode, editMode, setWrite } = useEditorSettings();
  const readOnly = useViewConfig((s) => s.config.readOnly);
  const { isMobile } = useBreakpoint();
  const setContent = useActiveNoteStore((s) => s.setContent);
  const noteId = useActiveNoteStore((s) => s.noteId);
  const save = useActiveNoteStore((s) => s.save);
  const isSaving = useActiveNoteStore((s) => s.isSaving);
  // Mobile has no top bar, and therefore no Save button, so leaving
  // write mode prompts for a save instead of silently dropping the
  // only obvious way back to the persisted note.
  const [savePromptOpen, setSavePromptOpen] = useState(false);

  const isRich = viewMode === "rich";

  const handleSourceToggle = useCallback(() => {
    if (isRich) {
      // `getContent` serialises the rich editor and re-attaches the
      // header image, so source mode always shows the full document.
      const markdown = useActiveNoteStore.getState().getContent();
      setSourceMarkdown(markdown);
      setViewMode("source");
      return;
    }
    // `force`: apply source edits even though `setSourceMarkdown`
    // already claimed this markdown (which the dedupe guard would skip).
    setContent(sourceMarkdown, true);
    setViewMode("rich");
  }, [isRich, sourceMarkdown, setSourceMarkdown, setViewMode, setContent]);

  // Tooltip/aria for the tap action; the FAB itself shows the current state.
  const readWriteLabel = editMode
    ? "Switch to read mode"
    : "Switch to write mode";

  const handleReadWriteToggle = useCallback(() => {
    if (!editMode) {
      // Entering write mode always starts with a clean prompt state.
      setSavePromptOpen(false);
      setWrite(true);
      return;
    }
    // Desktop has a Save button in the top bar; mobile does not.
    if (isMobile && noteId) {
      setSavePromptOpen(true);
      return;
    }
    setWrite(false);
  }, [editMode, isMobile, noteId, setWrite]);

  // Derive the visible state: a mode change from anywhere else
  // (keyboard, version restore, a route change) closes the prompt
  // without needing a synchronising effect.
  const savePromptVisible = savePromptOpen && editMode && isMobile;

  const handleSaveAndRead = useCallback(async () => {
    const hadDraft = noteId
      ? Boolean(useDraftStore.getState().drafts[noteId])
      : false;
    await save();
    // A failed save keeps the tracked draft. Stay in edit mode so the
    // user can retry instead of leaving the prompt and losing the
    // chance to persist.
    if (hadDraft && noteId && useDraftStore.getState().drafts[noteId]) {
      return;
    }
    setSavePromptOpen(false);
    setWrite(false);
  }, [noteId, save, setWrite]);

  const handleSkipSave = useCallback(() => {
    setSavePromptOpen(false);
    setWrite(false);
  }, [setWrite]);

  // Read-only badge: replaces the toggle when the share does not
  // grant write. Desktop gets an extended FAB with the "View only"
  // label next to the eye; mobile gets the icon only.
  const readOnlyLabel = "You only have read access";

  // ------------------------------------------------------------------
  // Mobile: the FABs move into the bottom bar as compact icon buttons
  // (mirroring `CreateActions`). The handlers live in a ref so the
  // registration effect only re-runs when a visible attribute (mode /
  // icon) changes rather than on every render.
  // ------------------------------------------------------------------
  const ownerId = useId();
  const setActions = useMobileActionsStore((s) => s.setActions);
  const clearActions = useMobileActionsStore((s) => s.clearActions);
  const handlersRef = useRef<{ readWrite: () => void; source: () => void }>({
    readWrite: () => {},
    source: () => {},
  });
  useEffect(() => {
    handlersRef.current = {
      readWrite: handleReadWriteToggle,
      source: handleSourceToggle,
    };
  }, [handleReadWriteToggle, handleSourceToggle]);

  useEffect(() => {
    if (!isMobile) {
      clearActions(ownerId);
      return;
    }
    const readWriteAction: MobileAction = readOnly
      ? {
          id: `${ownerId}-readonly`,
          label: readOnlyLabel,
          icon: <VisibilityIcon />,
          disabled: true,
          onClick: () => {},
        }
      : {
          id: `${ownerId}-readwrite`,
          label: readWriteLabel,
          icon: editMode ? <VisibilityIcon /> : <EditIcon />,
          onClick: () => handlersRef.current.readWrite(),
        };
    const actions: MobileAction[] = [
      readWriteAction,
      {
        id: `${ownerId}-source`,
        label: isRich ? "Swap to Source view" : "Swap to Rich editor",
        icon: isRich ? <CodeIcon /> : <ArticleIcon />,
        onClick: () => handlersRef.current.source(),
      },
    ];
    setActions(ownerId, actions);
    return () => clearActions(ownerId);
  }, [
    isMobile,
    ownerId,
    readOnly,
    readOnlyLabel,
    readWriteLabel,
    editMode,
    isRich,
    setActions,
    clearActions,
  ]);

  if (isMobile) {
    return (
      <SaveBeforeReadDialog
        open={savePromptVisible}
        saving={isSaving}
        onSave={handleSaveAndRead}
        onSkipSave={handleSkipSave}
        onCancel={() => setSavePromptOpen(false)}
      />
    );
  }

  const bottom = isMobile ? `calc(${M4} + ${MOBILE_BOTTOM_BAR_CLEARANCE})` : M4;
  const paperFg = theme.palette.getContrastText(
    theme.palette.background.default,
  );
  const primaryFg = theme.palette.getContrastText(theme.palette.primary.main);
  return (
    <Stack
      direction="row"
      spacing={M4}
      sx={{
        position: "fixed",
        alignItems: "center",
        bottom,
        right: M4,
        zIndex: 1300,
      }}
    >
      <Tooltip title={readOnly ? readOnlyLabel : readWriteLabel}>
        {readOnly ? (
          <Box
            role="img"
            aria-label={readOnlyLabel}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 56,
              minWidth: 56,
              paddingInline: isMobile ? undefined : 2,
              borderRadius: isMobile ? "100%" : theme.shape.borderRadius,
              backgroundColor: theme.palette.action.disabled,
              color: primaryFg,
              cursor: "default",
            }}
          >
            <VisibilityIcon
              sx={{ color: primaryFg, mr: isMobile ? undefined : 1 }}
            />
            {!isMobile && (
              <Typography sx={{ color: primaryFg }}>View only</Typography>
            )}
          </Box>
        ) : (
          <StateFab
            states={READ_WRITE_STATES}
            activeKey={editMode ? "edit" : "read"}
            color="primary"
            aria-label={readWriteLabel}
            expandOnHover
            onClick={handleReadWriteToggle}
          />
        )}
      </Tooltip>
      <Tooltip title={isRich ? "Swap to Source view" : "Swap to Rich editor"}>
        <StateFab
          states={SOURCE_STATES}
          activeKey={isRich ? "rich" : "source"}
          aria-label={isRich ? "Swap to Source view" : "Swap to Rich editor"}
          expandOnHover
          onClick={handleSourceToggle}
          color="inherit"
          sx={{
            backgroundColor: theme.palette.background.paper,
            color: paperFg,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: "none",
            "&:hover": { backgroundColor: theme.palette.action.hover },
          }}
        />
      </Tooltip>
    </Stack>
  );
};

export const InsertSpeedDial = memo(InsertSpeedDialImpl);
