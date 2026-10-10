import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Paper } from "@mui/material";
import { useThemeStore } from "../../zustand/useThemeStore";
import { BoldItalicMenu } from "./BoldItalicMenu";

// Symmetric enter/exit values used by the sx-prop transition.
const ENTER_DURATION_MS = 240;
const ENTER_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const EXIT_DURATION_MS = 160;

// Slide the wrapper between floating-ui position writes. See
// TextSelectionBubbleMenu for the full rationale.
const MOVE_DURATION_MS = 180;

export interface EditorBubbleMenuProps {
  editor: Editor;
  enabled?: boolean;
}
export const EditorBubbleMenu = ({
  editor,
  enabled = true,
}: EditorBubbleMenuProps) => {
  const { theme } = useThemeStore();

  // Always-mounted: keep the wrapper in the DOM whenever the menu
  // conditions are met so opacity / transform can animate both ways.
  const shouldShow = useCallback(
    ({ editor: viewEditor }: { editor: Editor }) =>
      enabled && viewEditor.isEditable && !viewEditor.isActive("table"),
    [enabled],
  );

  const isOpen = enabled && editor.isEditable && !editor.isActive("table");

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.style.transition = [
      `left ${MOVE_DURATION_MS}ms ease-out`,
      `top ${MOVE_DURATION_MS}ms ease-out`,
    ].join(", ");
    return () => {
      el.style.transition = "";
    };
  }, [isOpen]);

  const opacityTransition = useMemo(
    () =>
      theme.transitions.create("opacity", {
        duration: isOpen ? ENTER_DURATION_MS : EXIT_DURATION_MS,
        easing: isOpen
          ? ENTER_EASING
          : theme.transitions.easing.easeOut,
      }),
    [theme, isOpen],
  );
  const transformTransition = useMemo(
    () =>
      theme.transitions.create("transform", {
        duration: isOpen ? ENTER_DURATION_MS : EXIT_DURATION_MS,
        easing: isOpen
          ? ENTER_EASING
          : theme.transitions.easing.easeOut,
      }),
    [theme, isOpen],
  );

  return (
    <BubbleMenu
      options={{ placement: "bottom", offset: 8, flip: true }}
      editor={editor}
      shouldShow={shouldShow}
      ref={wrapperRef}
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
    </BubbleMenu>
  );
};

