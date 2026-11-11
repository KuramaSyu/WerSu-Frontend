// ---------------------------------------------------------------------------
// NoteTitleBar
// Title input row at the top of the editor. Memoized. Multiline so
// long titles wrap onto multiple lines instead of scrolling.
// ---------------------------------------------------------------------------

import { memo } from "react";
import { Box, Input, Stack } from "@mui/material";
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
}

const NoteTitleBarImpl: React.FC<NoteTitleBarProps> = ({
  title,
  setTitle,
  forceFullWidth,
  readOnly = false,
}) => {
  const { theme } = useThemeStore();
  logRerender("NoteTitleBar", { titleLen: title.length });

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        alignContent: "flex-start",
        width: "100%",
      }}
      spacing={M3}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <Input
          fullWidth
          multiline
          disabled={readOnly}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Note title"
          disableUnderline
          sx={{
            fontSize: theme.typography.h3,
            fontFamily: theme.custom?.accentFontFamily ?? ACCENT_FONT_FAMILY,
            fontWeight: 400,
            fontOpticalSizing: "auto",
            pr: forceFullWidth ? 0 : M2,
            // Wrap and grow vertically; no horizontal scroll.
            "& textarea": {
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflow: "hidden",
              resize: "none",
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
    </Stack>
  );
};

/** Memoized title row so editor-body re-renders do not reset the caret. */
export const NoteTitleBar = memo(NoteTitleBarImpl);
