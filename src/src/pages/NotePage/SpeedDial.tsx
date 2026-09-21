// Floating editor actions: read/write FAB and source/rich FAB.
// Save lives in the desktop top bar.

import { Box, ButtonBase, Fab, Stack, Tooltip } from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import type { Editor } from "@tiptap/react";
import { M4, MOBILE_BOTTOM_BAR_CLEARANCE } from "../../statics";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useActiveNoteStore } from "../../zustand/editorStore";
import { useThemeStore } from "../../zustand/useThemeStore";

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

export const InsertSpeedDial: React.FC<InsertSpeedDialProps> = ({
  editor,
  sourceMarkdown,
  setSourceMarkdown,
}) => {
  const { theme } = useThemeStore();
  const { viewMode, setViewMode, editMode, setWrite } = useEditorSettings();
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
      <Tooltip title={readWriteLabel}>
        <Fab
          size="large"
          color="primary"
          aria-label={readWriteLabel}
          onClick={() => setWrite(!editMode)}
        >
          <ReadWriteIcon sx={{ color: primaryFg }} />
        </Fab>
      </Tooltip>
      <SecondaryFab
        label={isRich ? "Source view" : "Rich editor"}
        onClick={handleSourceToggle}
      >
        {isRich ? (
          <CodeIcon sx={{ color: paperFg }} />
        ) : (
          <EditIcon sx={{ color: paperFg }} />
        )}
      </SecondaryFab>
    </Stack>
  );
};
