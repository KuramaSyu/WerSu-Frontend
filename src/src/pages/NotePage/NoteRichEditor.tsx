// ---------------------------------------------------------------------------
// NoteRichEditor
// Renders the rich editor surface (bubble menu, slash command, drag
// handle, themed editor box, EditorContent). Memoized: with
// shouldRerenderOnTransaction=false, only the bubble menu re-renders
// per transaction, not the surrounding Box.
// ---------------------------------------------------------------------------

import { memo } from "react";
import { Box } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { SlashCommand } from "../../components/Editor/SlashCommandMenu";
import { TextSelectionBubbleMenu } from "../../components/Editor/TextSelectionBubbleMenu";
import { SlashCommandMenu } from "../../components/Editor/SlashCommandMenu";
import { ThemedEditorBox } from "../../components/Editor/ThemedEditorBox";
import { logRerender } from "./editorRenderLog";

export interface NoteRichEditorProps {
  editor: Editor;
  editMode: boolean;
  editorWidth: number | string;
  extraCommands: SlashCommand[];
}

const NoteRichEditorImpl: React.FC<NoteRichEditorProps> = ({
  editor,
  editMode,
  editorWidth,
  extraCommands,
}) => {
  logRerender("NoteRichEditor", {
    editMode,
    extraCommandsLen: extraCommands.length,
  });
  return (
    <Box
      sx={{
        width: editorWidth,
        mx: "auto",
        transition: (t) =>
          t.transitions.create("width", {
            duration: t.transitions.duration.complex,
          }),
      }}
    >
      <TextSelectionBubbleMenu editor={editor} enabled={editMode} />
      <SlashCommandMenu
        editor={editor}
        enabled={editMode}
        extraCommands={extraCommands}
      />
      <Box className="editor-drag-region">
        <DragHandle
          editor={editor}
          className={`note-block-drag-handle ${editMode ? "" : "note-block-drag-handle--hidden"} `}
          nested={false}
        >
          <DragIndicatorIcon fontSize="small" />
        </DragHandle>
        {/* Smooth caret overlay is rendered by the
            `CaretAnimation` Tiptap extension as a `Decoration.widget`
            inside the document tree (see NoteEditorCore.hook.tsx),
            so it follows text flow and scrolls with the editor. */}
        <ThemedEditorBox editor={editor}>
          <EditorContent editor={editor} className="tiptap" />
        </ThemedEditorBox>
      </Box>
    </Box>
  );
};

/** Memoized rich surface. extraCommands is itself memoized upstream. */
export const NoteRichEditor = memo(NoteRichEditorImpl);
