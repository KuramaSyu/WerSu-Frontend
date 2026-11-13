// ---------------------------------------------------------------------------
// NoteTitleBar
// Title input row at the top of the editor. Memoized. Multiline so
// long titles wrap onto multiple lines instead of scrolling; when a
// title does wrap it drops one typography step (h2 -> h3).
// ---------------------------------------------------------------------------

import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Box, IconButton, Input, Stack, Tooltip } from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { M2, M3 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { ACCENT_FONT_FAMILY } from "../../theme/customTheme";
import { logRerender } from "./editorRenderLog";

export interface NoteTitleBarProps {
  title: string;
  setTitle: (title: string) => void;
  /** When true, drop the right padding so the title hugs the screen edge. */
  forceFullWidth: boolean;
  /**
   * When true the title is static text. This covers read-only shares
   * and the whole view mode -- writers can only rename a note while
   * the editor is in edit mode.
   */
  readOnly?: boolean;
  /** Show the photo action on the right to insert a header image. */
  showHeaderImageAction?: boolean;
  /** Invoked when the photo action is pressed. */
  onInsertHeaderImage?: () => void;
  /**
   * Shrink the title to the width of its text instead of filling the
   * row. Used when the title sits inside the banner's blurred backdrop
   * so the blur hugs the actual font.
   */
  fitContent?: boolean;
}

const NoteTitleBarImpl: React.FC<NoteTitleBarProps> = ({
  title,
  setTitle,
  forceFullWidth,
  readOnly = false,
  showHeaderImageAction = false,
  onInsertHeaderImage,
  fitContent = false,
}) => {
  const { theme } = useThemeStore();
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [titleWrapped, setTitleWrapped] = useState(false);
  const baseTitleFontSize = theme.typography.h2.fontSize;
  const compactTitleFontSize =
    theme.typography.h3.fontSize ?? baseTitleFontSize;

  // The title gets one step smaller as soon as it wraps. Measure at the
  // *base* size regardless of the size currently painted, so shrinking
  // the text cannot make the next measurement report "fits on one line"
  // and flip the title back to the larger size.
  const measureTitleWrapping = useCallback(() => {
    const input = titleInputRef.current;
    if (!input) {
      return;
    }
    const previousFontSize = input.style.fontSize;
    input.style.fontSize =
      typeof baseTitleFontSize === "number"
        ? `${baseTitleFontSize}px`
        : String(baseTitleFontSize ?? "");
    const computed = window.getComputedStyle(input);
    let lineHeight = Number.parseFloat(computed.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
      const fontSize = Number.parseFloat(computed.fontSize);
      lineHeight = Number.isFinite(fontSize) ? fontSize * 1.2 : 0;
    }
    const wrapped = lineHeight > 0 && input.scrollHeight > lineHeight * 1.5;
    input.style.fontSize = previousFontSize;
    setTitleWrapped((current) => (current === wrapped ? current : wrapped));
  }, [baseTitleFontSize]);

  // Runs before paint, so the temporary base-size measurement never
  // flashes on screen.
  useLayoutEffect(() => {
    measureTitleWrapping();
  }, [title, measureTitleWrapping, fitContent, forceFullWidth]);

  // The line-end check also has to react to width changes (window,
  // rail, banner), not just to edits.
  useLayoutEffect(() => {
    const input = titleInputRef.current;
    if (!input || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      measureTitleWrapping();
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [measureTitleWrapping]);

  logRerender("NoteTitleBar", {
    titleLen: title.length,
    titleWrapped,
  });

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        alignContent: "flex-start",
        width: fitContent ? "auto" : "100%",
        maxWidth: "100%",
      }}
      spacing={M3}
    >
      <Box
        sx={{
          flex: fitContent ? "0 1 auto" : 1,
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        <Input
          inputRef={titleInputRef}
          fullWidth={!fitContent}
          multiline
          disabled={readOnly}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Note title"
          disableUnderline
          sx={{
            fontSize: titleWrapped ? compactTitleFontSize : baseTitleFontSize,
            fontFamily: theme.custom?.accentFontFamily ?? ACCENT_FONT_FAMILY,
            // Inherit so a banner can hand the title its contrast color.
            pr: forceFullWidth ? 0 : M2,
            // Wrap and grow vertically; no horizontal scroll.
            "& textarea": {
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflow: "hidden",
              resize: "none",
              ...(fitContent
                ? {
                    width: "auto",
                    // Size the control to its text so the parent can
                    // shrink-wrap the blurred backdrop around it.
                    fieldSizing: "content",
                  }
                : undefined),
            },
            // The field is rendered `disabled` to make it inert, but
            // the title should still look like normal text instead of
            // MUI's greyed-out disabled colour.
            "& .MuiInputBase-input.Mui-disabled": {
              color: theme.palette.text.primary,
              WebkitTextFillColor: theme.palette.text.primary,
            },
          }}
        />
      </Box>
      {showHeaderImageAction && onInsertHeaderImage && (
        <Tooltip title="Insert header image">
          <IconButton
            aria-label="insert header image"
            onClick={onInsertHeaderImage}
            size="small"
            sx={{ alignSelf: "flex-start", mt: 1 }}
          >
            <AddPhotoAlternateIcon />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
};

/** Memoized title row so editor-body re-renders do not reset the caret. */
export const NoteTitleBar = memo(NoteTitleBarImpl);
