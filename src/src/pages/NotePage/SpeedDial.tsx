// Floating editor actions: read/write FAB (or a read-only badge when
// the view is not writable) and source/rich FAB. Save lives in the
// desktop top bar.

import { memo } from "react";
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

  const handleSourceToggle = () => {
    if (isRich) {
      const markdown = editor?.getMarkdown() ?? sourceMarkdown;
      setSourceMarkdown(markdown);
      setViewMode("source");
      return;
    }
    setContent(sourceMarkdown);
    setViewMode("rich");
  };

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
