import { SpeedDial, SpeedDialAction, SpeedDialIcon } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CodeIcon from "@mui/icons-material/Code";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import { M4 } from "../../statics";
import { useEditorSettings } from "../../zustand/useEditorSettings";
import { LatexDialog } from "./LatexDialog";
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
  const { viewMode, setViewMode } = useEditorSettings();
  const [latexDialogOpen, setLatexDialogOpen] = useState(false);

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
    (latex: string) => {
      const hasSelection = !editor.state.selection.empty;

      if (hasSelection) {
        return editor.chain().insertBlockMath({ latex: "" }).focus().run();
      }

      // const latex = prompt("Enter block math expression:", "");
      // if (!latex) {
      //   return;
      // }
      return editor.chain().insertBlockMath({ latex }).focus().run();
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
      <SpeedDial
        ariaLabel="Editor actions"
        sx={{ position: "fixed", bottom: M4, right: M4, zIndex: 1300 }}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<SaveIcon />}
          tooltipTitle="Save"
          onClick={() => void handleSave()}
        />
        {viewMode === "rich" ? (
          <SpeedDialAction
            icon={<CodeIcon />}
            tooltipTitle="Source view"
            onClick={() => {
              const markdown = editor?.getMarkdown() ?? sourceMarkdown;
              setSourceMarkdown(markdown);
              setViewMode("source");
            }}
          />
        ) : (
          <SpeedDialAction
            icon={<EditIcon />}
            tooltipTitle="Rich editor"
            onClick={() => {
              if (editor) {
                editor.commands.setContent(sourceMarkdown, {
                  contentType: "markdown",
                });
              }
              setViewMode("rich");
            }}
          />
        )}
        <SpeedDialAction
          icon={<HistoryIcon />}
          tooltipTitle="Versions"
          onClick={() => setVersionsOpen(true)}
        />

        <SpeedDialAction
          icon={<AddPhotoAlternateIcon />}
          tooltipTitle="Upload Image"
          onClick={() => setFileUploadDialogOpen(true)}
        />
        <SpeedDialAction
          icon={<FunctionsIcon />}
          slotProps={{ tooltip: { title: "Insert LaTeX" } }}
          onClick={() => setLatexDialogOpen(true)}
        />
      </SpeedDial>
      <LatexDialog
        open={latexDialogOpen}
        onClose={(latex) => {
          setLatexDialogOpen(false);
          onInsertBlockMath(latex);
        }}
      />
    </>
  );
};
