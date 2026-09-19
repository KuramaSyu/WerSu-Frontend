import { Box, Paper, Stack } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";
import type React from "react";
import { topbarContrastText } from "../theme/topbarContrastText";

/** Render a keyboard shortcut string into styled chips; "+" is shown, "," is silent. */
export function renderShortcut(
  shortcut: string,
  onlyText: boolean = false,
): React.ReactNode {
  const { theme } = useThemeStore();
  var components: React.ReactNode[] = [];
  for (const [index, key] of shortcut.split(/([+,])/).entries()) {
    // Process each key
    if (key === "+") {
      components.push(
        <Box
          key={index}
          component="span"
          sx={{ mx: 0.5, color: topbarContrastText(theme) }}
        >
          {key}
        </Box>,
      );
    } else if (key === ",") {
      // Do nothing for the comma separator
    } else if (key === "super" || key === "cmd" || key === "ctrl") {
      components.push(
        <Key key={index} onlyText={onlyText}>
          {superKey()}
        </Key>,
      );
    } else {
      components.push(
        <Key key={index} onlyText={onlyText}>
          {key}
        </Key>,
      );
    }
  }
  return (
    <Stack sx={{ alignItems: "center" }} direction="row">
      {components}
    </Stack>
  );
}

function superKey(): React.ReactNode {
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  return isMac ? "⌘" : "Ctrl";
}

function Key({
  children,
  onlyText,
}: {
  children: React.ReactNode;
  onlyText?: boolean;
}): React.ReactNode {
  const { theme } = useThemeStore();
  return (
    <Paper
      // component="kbd"
      elevation={onlyText ? 0 : 4}
      sx={{
        fontSize: "inherit",
        // color: theme.palette.background.paper,
        border: onlyText ? undefined : `1px solid`,
        px: 1,
        borderRadius: onlyText ? undefined : theme.shape.borderRadius,
        fontFamily: "monospace",
      }}
    >
      {children}
    </Paper>
  );
}

export const KeyboardShortcut: React.FC<{
  shortcut: string;
  onlyText?: boolean;
}> = ({ shortcut, onlyText = false }) => {
  return <>{renderShortcut(shortcut, onlyText)}</>;
};
