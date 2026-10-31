// Floating toolbar shown above a selected image node. Holds the
// aspect-ratio lock toggle and quick width presets (25/50/75/100%). The
// actual resize handles live in the node view; both read the shared
// lock state from `useImageResizeStore`.

import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import { useCallback } from "react";
import {
  Divider,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useImageResizeStore } from "../../zustand/useImageResizeStore";
import { defaultImageResizeStrategy } from "./imageResizeStrategy";
import {
  applyImageWidth,
  getSelectedImage,
} from "./imageSelection";

export interface ImageBubbleMenuProps {
  editor: Editor;
  enabled?: boolean;
}

export const ImageBubbleMenu = ({
  editor,
  enabled = true,
}: ImageBubbleMenuProps) => {
  const { theme } = useThemeStore();
  const locked = useImageResizeStore((state) => state.locked);
  const toggleLocked = useImageResizeStore((state) => state.toggleLocked);

  // Re-render the quick-size highlight as the selection changes.
  const { hasImage, style } = useEditorState({
    editor,
    selector: (ctx) => {
      const node = getSelectedImage(ctx.editor);
      return {
        hasImage: Boolean(node),
        style: (node?.attrs.style as string | null) ?? null,
      };
    },
  });

  const shouldShow = useCallback(
    ({ editor: viewEditor }: { editor: Editor }) =>
      enabled && viewEditor.isEditable && Boolean(getSelectedImage(viewEditor)),
    [enabled],
  );

  const currentWidth = defaultImageResizeStrategy.parse(style).width;
  const activeQuick =
    defaultImageResizeStrategy.quickSizes.find(
      (quick) =>
        currentWidth?.unit === quick.width.unit &&
        currentWidth?.value === quick.width.value,
    )?.label ?? null;

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={0}
      resizeDelay={0}
      options={{ placement: "top", offset: 10, flip: true }}
      shouldShow={shouldShow}
    >
      <Paper
        elevation={2}
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 50,
          px: 0.5,
          py: 0.25,
          opacity: hasImage ? 1 : 0,
          pointerEvents: hasImage ? "auto" : "none",
        }}
      >
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Tooltip
            title={
              locked
                ? "Aspect ratio locked (click to stretch freely)"
                : "Aspect ratio unlocked (click to lock)"
            }
          >
            <IconButton
              size="small"
              color={locked ? "primary" : "default"}
              onClick={toggleLocked}
              aria-label={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            >
              {locked ? (
                <LockIcon fontSize="small" />
              ) : (
                <LockOpenIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ my: 1 }} />

          <ToggleButtonGroup
            exclusive
            size="small"
            value={activeQuick}
            onChange={(_event, value: string | null) => {
              if (!value) return;
              const quick = defaultImageResizeStrategy.quickSizes.find(
                (candidate) => candidate.label === value,
              );
              if (quick) applyImageWidth(editor, quick.width);
            }}
            aria-label="Image width"
          >
            {defaultImageResizeStrategy.quickSizes.map((quick) => (
              <ToggleButton
                key={quick.label}
                value={quick.label}
                sx={{
                  px: 1,
                  py: 0.25,
                  lineHeight: 1.6,
                  textTransform: "none",
                  fontWeight: 600,
                }}
              >
                {quick.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Paper>
    </BubbleMenu>
  );
};
