import {
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Stack,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CodeIcon from "@mui/icons-material/Code";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import HistoryIcon from "@mui/icons-material/History";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import { M4, MOBILE_BOTTOM_BAR_CLEARANCE } from "../../statics";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { useThemeStore } from "../../zustand/useThemeStore";
import { LatexDialog } from "./LatexDialog";
import { useActiveNoteStore } from "../../zustand/editorStore";
import FunctionsIcon from "@mui/icons-material/Functions";

export interface InsertSpeedDialProps {
  editor: Editor;
  sourceMarkdown: string;
  setSourceMarkdown: (markdown: string) => void;
  handleSave: () => Promise<void>;
  setVersionsOpen: (open: boolean) => void;
  setFileUploadDialogOpen: (open: boolean) => void;
}
export const InsertSpeedDial: React.FC<InsertSpeedDialProps> = ({
  editor,
  sourceMarkdown,
  setSourceMarkdown,
  handleSave,
  setVersionsOpen,
  setFileUploadDialogOpen,
}) => {
  const { viewMode, setViewMode, editMode, setWrite } = useEditorSettings();
  const { theme } = useThemeStore();
  const { isMobile } = useBreakpoint();
  const setContent = useActiveNoteStore((s) => s.setContent);
  const [latexDialogOpen, setLatexDialogOpen] = useState(false);

  // Same vertical clearance the SpeedDial uses: lift above the
  // mobile bottom bar, regular `M4` on desktop.
  const fabPositionSx = {
    position: "fixed" as const,
    bottom: isMobile ? `calc(${M4} + ${MOBILE_BOTTOM_BAR_CLEARANCE})` : M4,
    // Sit to the right of the SpeedDial so the two don't overlap.
    // SpeedDial's primary fab is ~56px wide; the gap + the
    // secondary fab's width keep a clear visual separation.
    right: `calc(${M4} + 56px + ${M4})`,
    zIndex: 1300,
  };

  // callbacks for the Mathematics extension
  const onInsertInlineMath = useCallback(() => {
    const hasSelection = !editor.state.selection.empty;

    if (hasSelection) {
      return editor.chain().insertInlineMath({ latex: "" }).focus().run();
    }

    const latex = prompt("Enter inline math expression:", "");
    if (!latex) {
      return;
    }
    return editor.chain().insertInlineMath({ latex }).focus().run();
  }, [editor]);

  const onRemoveInlineMath = useCallback(() => {
    editor.chain().deleteInlineMath().focus().run();
  }, [editor]);

  const onInsertBlockMath = useCallback(
    (latex: string, inline: "inline" | "block", compressed: boolean) => {
      const hasSelection = !editor.state.selection.empty;

      if (hasSelection) {
        return editor.chain().insertBlockMath({ latex: "" }).focus().run();
      }

      const chain = editor.chain();

      if (inline === "inline") {
        chain.insertInlineMath({ latex: latex });
      } else {
        chain.insertBlockMath({ latex: latex });
      }

      chain.focus().run();
    },
    [editor],
  );

  const onRemoveBlockMath = useCallback(() => {
    editor.chain().deleteBlockMath().focus().run();
  }, [editor]);

  {
    /* Floating editor actions */
  }
  return (
    <>
      <Stack
        spacing={3}
        direction="row-reverse"
        sx={{
          position: "fixed",
          alignItems: "flex-end",
          bottom: isMobile
            ? `calc(${M4} + ${MOBILE_BOTTOM_BAR_CLEARANCE})`
            : M4,
          right: M4,
          zIndex: 1300,
        }}
      >
        <SpeedDial ariaLabel="Editor actions" icon={<SpeedDialIcon />}>
          <SpeedDialAction
            icon={<SaveIcon />}
            slotProps={{
              tooltip: { title: "Save" },
            }}
            onClick={() => void handleSave()}
          />
          {viewMode === "rich" ? (
            <SpeedDialAction
              icon={<CodeIcon />}
              slotProps={{
                tooltip: { title: "Source view" },
              }}
              onClick={() => {
                const markdown = editor?.getMarkdown() ?? sourceMarkdown;
                setSourceMarkdown(markdown);
                setViewMode("source");
              }}
            />
          ) : (
            <SpeedDialAction
              icon={<EditIcon />}
              slotProps={{
                tooltip: { title: "Rich editor" },
              }}
              onClick={() => {
                setContent(sourceMarkdown);
                setViewMode("rich");
              }}
            />
          )}
          <SpeedDialAction
            icon={<HistoryIcon />}
            slotProps={{
              tooltip: { title: "Version history" },
            }}
            onClick={() => setVersionsOpen(true)}
          />

          <SpeedDialAction
            icon={<AddPhotoAlternateIcon />}
            slotProps={{
              tooltip: { title: "Upload Image" },
            }}
            onClick={() => setFileUploadDialogOpen(true)}
          />
          <SpeedDialAction
            icon={<FunctionsIcon />}
            slotProps={{ tooltip: { title: "Insert LaTeX" } }}
            onClick={() => setLatexDialogOpen(true)}
          />
        </SpeedDial>
        {/* Read/write toggle FAB. Sits to the right of the
          SpeedDial so the two don't overlap. The icon shows the
          mode the tap will switch *into* -- eye when currently
          writable (tap to read), pencil when currently read-only
          (tap to write). Mirrors the editor's URL deep-link:
          `?mode=write` is the way to land in write mode from
          outside; this FAB is the way to flip back. */}
        <Fab
          size="large"
          color="primary"
          aria-label={editMode ? "Switch to read mode" : "Switch to write mode"}
          onClick={() => setWrite(!editMode)}
        >
          {editMode ? <VisibilityIcon /> : <EditIcon />}
        </Fab>
      </Stack>
      <LatexDialog
        open={latexDialogOpen}
        onClose={(latex, inline, compressed) => {
          setLatexDialogOpen(false);
          onInsertBlockMath(latex, inline, compressed);
        }}
      />
    </>
  );
};
