// ---------------------------------------------------------------------------
// NoteTitleBar
// Title input row at the top of the editor. Memoized. The wrapper
// constrains the Input to the available space; minWidth: 0 prevents
// a long title from growing the row, overflow: hidden clips the caret.
// ---------------------------------------------------------------------------

import { memo } from "react";
import { Box, Input, Stack } from "@mui/material";
import { M2, M3 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { logRerender } from "./editorRenderLog";

export interface NoteTitleBarProps {
  title: string;
  setTitle: (title: string) => void;
  /** When true, drop the right padding so the title hugs the screen edge. */
  forceFullWidth: boolean;
}

const NoteTitleBarImpl: React.FC<NoteTitleBarProps> = ({
  title,
  setTitle,
  forceFullWidth,
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
          overflow: "hidden",
        }}
      >
        <Input
          fullWidth
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Note title"
          disableUnderline
          sx={{
            fontSize: theme.typography.h3,
            pr: forceFullWidth ? 0 : M2,
          }}
        />
      </Box>
    </Stack>
  );
};

/** Memoized title row so editor-body re-renders do not reset the caret. */
export const NoteTitleBar = memo(NoteTitleBarImpl);
