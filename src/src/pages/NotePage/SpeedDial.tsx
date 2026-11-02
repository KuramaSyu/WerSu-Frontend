// Floating editor actions: read/write FAB (or a read-only badge when
// the view is not writable) and source/rich FAB. Save lives in the
// desktop top bar.
//
// On mobile the two FABs are not rendered on the canvas; instead they
// register with `useMobileActionsStore` so `MobileBottomBar` shows them
// as compact icon buttons (see `CreateActions` for the same pattern).

import { memo, useCallback, useEffect, useId, useRef } from "react";
import {
  Box,
  ButtonBase,
  Fab,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
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
import { logRerender } from "./editorRenderLog";
import ArticleIcon from "@mui/icons-material/Article";

export interface InsertSpeedDialProps {
  editor: Editor | null;
  sourceMarkdown: string;
  setSourceMarkdown: (markdown: string) => void;
}

// Round 56x56 secondary FAB: paper bg, divider border, hover tint.
const SecondaryFab: React.FC<{
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, onClick, children }) => {
  const { theme } = useThemeStore();
  return (
    <Tooltip title={label}>
      <ButtonBase
        aria-label={label}
        onClick={onClick}
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          transition: theme.transitions.create([
            "background-color",
            "transform",
            "box-shadow",
          ]),
          "&:hover": {
            backgroundColor: theme.palette.action.hover,
            borderRadius: "50%",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          {children}
        </Box>
      </ButtonBase>
    </Tooltip>
  );
};

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

  const isRich = viewMode === "rich";

  const handleSourceToggle = useCallback(() => {
    if (isRich) {
      const markdown = editor?.getMarkdown() ?? sourceMarkdown;
      setSourceMarkdown(markdown);
      setViewMode("source");
      return;
    }
    // `force`: apply source edits even though `setSourceMarkdown`
    // already claimed this markdown (which the dedupe guard would skip).
    setContent(sourceMarkdown, true);
    setViewMode("rich");
  }, [
    isRich,
    editor,
    sourceMarkdown,
    setSourceMarkdown,
    setViewMode,
    setContent,
  ]);

  // Read/write FAB icon shows the mode the tap switches INTO,
  // not the current mode.
  const readWriteLabel = editMode
    ? "Switch to read mode"
    : "Switch to write mode";
  const ReadWriteIcon = editMode ? VisibilityIcon : EditIcon;

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
      readWrite: () => setWrite(!editMode),
      source: handleSourceToggle,
    };
  }, [setWrite, editMode, handleSourceToggle]);

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
    return null;
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
          <Fab
            size="large"
            color="primary"
            aria-label={readWriteLabel}
            onClick={() => setWrite(!editMode)}
          >
            <ReadWriteIcon sx={{ color: primaryFg }} />
          </Fab>
        )}
      </Tooltip>
      <SecondaryFab
        label={isRich ? "Swap to Source view" : "Swap to Rich editor"}
        onClick={handleSourceToggle}
      >
        {isRich ? (
          <CodeIcon sx={{ color: paperFg }} />
        ) : (
          <ArticleIcon sx={{ color: paperFg }} />
        )}
      </SecondaryFab>
    </Stack>
  );
};

export const InsertSpeedDial = memo(InsertSpeedDialImpl);
