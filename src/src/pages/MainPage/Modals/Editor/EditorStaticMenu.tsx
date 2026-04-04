import { Button, Stack } from "@mui/material";
import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
import { BoldItalicMenu } from "./BoldItalicMenu";
import { TableButtonGroup } from "./TableButtonGroup";

export interface EditorBubbleMenuProps {
  editor: Editor;
  isSourceMode: boolean;
  onToggleSourceMode: () => void;
}
export const EditorStaticMenu = ({
  editor,
  isSourceMode,
  onToggleSourceMode,
}: EditorBubbleMenuProps) => {
  const [isEditable, setIsEditable] = useState(editor.isEditable);

  useEffect(() => {
    const syncEditable = () => {
      setIsEditable(editor.isEditable);
    };

    editor.on("transaction", syncEditable);
    return () => {
      editor.off("transaction", syncEditable);
    };
  }, [editor]);

  const toggleReadOnly = () => {
    editor.setEditable(!editor.isEditable);
    setIsEditable(editor.isEditable);
  };

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center">
        <BoldItalicMenu editor={editor} />
        <TableButtonGroup editor={editor} />
        <Button size="small" variant="outlined" onClick={onToggleSourceMode}>
          {isSourceMode ? "Rich" : "Source"}
        </Button>
        <Button size="small" variant="outlined" onClick={toggleReadOnly}>
          {isEditable ? "View" : "Edit"}
        </Button>
      </Stack>
    </>
  );
};
