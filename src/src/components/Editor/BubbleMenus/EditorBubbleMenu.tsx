import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useMemo } from "react";
import { Paper } from "@mui/material";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { NodeSelection } from "@tiptap/pm/state";
import { BoldItalicMenu } from "./BoldItalicMenu";
import { BubbleMenuSurface } from "./BubbleMenuSurface";
import { useTextSelectionAnchor } from "./useBubbleMenuAnchor";
import { useEditorEditable } from "./useEditorEditable";

// Symmetric enter/exit values used by the sx-prop transition.
const ENTER_DURATION_MS = 240;
const ENTER_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const EXIT_DURATION_MS = 160;

export interface EditorBubbleMenuProps {
  editor: Editor;
  enabled?: boolean;
}

/**
 * Legacy minimal formatting bubble menu (bold / italic / strike) used by
 * the note edit modal. The full note editor uses
 * `TextSelectionBubbleMenu`. Kept on the shared surface so it gets the
 * same reliable show/hide behaviour.
 */
export const EditorBubbleMenu = ({
  editor,
  enabled = true,
}: EditorBubbleMenuProps) => {
  const { theme } = useThemeStore();
  const editorEditable = useEditorEditable(editor);

  const { hasSelection, inTable } = useEditorState({
    editor,
    selector: (ctx) => {
      const { selection } = ctx.editor.state;
      return {
        hasSelection:
          selection.from !== selection.to &&
          !(selection instanceof NodeSelection),
        inTable: ctx.editor.isActive("table"),
      };
    },
  });

  const isOpen = enabled && editorEditable && hasSelection && !inTable;
  const anchor = useTextSelectionAnchor(editor, isOpen);

  const opacityTransition = useMemo(
    () =>
      theme.transitions.create("opacity", {
        duration: isOpen ? ENTER_DURATION_MS : EXIT_DURATION_MS,
        easing: isOpen ? ENTER_EASING : theme.transitions.easing.easeOut,
      }),
    [theme, isOpen],
  );
  const transformTransition = useMemo(
    () =>
      theme.transitions.create("transform", {
        duration: isOpen ? ENTER_DURATION_MS : EXIT_DURATION_MS,
        easing: isOpen ? ENTER_EASING : theme.transitions.easing.easeOut,
      }),
    [theme, isOpen],
  );

  return (
    <BubbleMenuSurface
      open={isOpen}
      anchor={anchor}
      placement="bottom"
      offset={8}
      flip
    >
      <Paper
        elevation={2}
        sx={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen
            ? "translateY(0) scale(1)"
            : "translateY(-8px) scale(0.94)",
          transformOrigin: "center",
          transition: [opacityTransition, transformTransition].join(", "),
          pointerEvents: isOpen ? "auto" : "none",
          p: 0.5,
        }}
      >
        <BoldItalicMenu editor={editor} />
      </Paper>
    </BubbleMenuSurface>
  );
};
