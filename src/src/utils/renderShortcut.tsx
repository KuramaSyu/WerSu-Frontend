import { Box, Paper, Stack, alpha } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";
import type React from "react";
import { topbarContrastText } from "../theme/topbarContrastText";

/** Render a keyboard shortcut string into styled chips; "+" is shown, "," is silent. */
export function renderShortcut(
  shortcut: string,
  onlyText: boolean = false,
  accentColor?: string,
): React.ReactNode {
  const { theme } = useThemeStore();
  const components: React.ReactNode[] = [];
  for (const [index, key] of shortcut.split(/([+,])/).entries()) {
    // Process each key
    if (key === "+") {
      components.push(
        <Box
          key={index}
          component="span"
          sx={{ mx: 0.5, color: accentColor ?? topbarContrastText(theme) }}
        >
          {key}
        </Box>,
      );
    } else if (key === ",") {
      // Do nothing for the comma separator
    } else if (key === "super" || key === "cmd" || key === "ctrl") {
      components.push(
        <Key key={index} onlyText={onlyText} accentColor={accentColor}>
          {superKey()}
        </Key>,
      );
    } else {
      components.push(
        <Key key={index} onlyText={onlyText} accentColor={accentColor}>
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
  accentColor,
}: {
  children: React.ReactNode;
  onlyText?: boolean;
  accentColor?: string;
}): React.ReactNode {
  const { theme } = useThemeStore();
  return (
    <Paper
      // component="kbd"
      elevation={onlyText ? 0 : 4}
      sx={{
        fontSize: "inherit",
        color: accentColor,
        // color: theme.palette.background.paper,
        border: onlyText ? undefined : `1px solid`,
        borderColor:
          accentColor !== undefined ? alpha(accentColor, 0.45) : undefined,
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
  /** Optional accent for the key chips and the "+" separator. */
  accentColor?: string;
}> = ({ shortcut, onlyText = false, accentColor }) => {
  return <>{renderShortcut(shortcut, onlyText, accentColor)}</>;
};
