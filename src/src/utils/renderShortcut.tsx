import { Box, Paper } from "@mui/material";
import { useThemeStore } from "../zustand/useThemeStore";
import type React from "react";

/**
 * Renders a keyboard shortcut string into styled React components.
 *
 * @param shortcut - A keyboard shortcut string with keys separated by `+` or `,`
 *                   Examples: "ctrl+c", "cmd+shift+s", "alt,ctrl,del"
 * @returns A React node containing the rendered shortcut with styled components
 *
 * @example
 * ```tsx
 * renderShortcut("ctrl+c") // Renders: [ctrl symbol] + [c key]
 * renderShortcut("cmd+shift+s") // Renders: [cmd symbol] + [shift key] + [s key]
 * ```
 *
 * @remarks
 * - The `+` separator is rendered as a styled separator element
 * - The `,` separator acts as a silent separator (no visual representation)
 * - Special keys like "super", "cmd", and "ctrl" are rendered using the `superKey()` function
 * - Regular keys are rendered as `<kbd>` elements with secondary text color
 * - All components are wrapped in a flexbox container with centered alignment
 */
export function renderShortcut(shortcut: string): React.ReactNode {
  var components: React.ReactNode[] = [];
  for (const [index, key] of shortcut.split(/([+,])/).entries()) {
    // Process each key
    console.log("key", key);
    if (key === "+") {
      components.push(
        <Box key={index} component="span" sx={{ mx: 0.5 }}>
          {key}
        </Box>,
      );
    } else if (key === ",") {
      // Do nothing for the comma separator
    } else if (key === "super" || key === "cmd" || key === "ctrl") {
      components.push(<Key>{superKey()}</Key>);
    } else {
      components.push(<Key>{key}</Key>);
    }
  }
  return (
    <Box display={"flex"} alignItems={"center"}>
      {components}
    </Box>
  );
}

function superKey(): React.ReactNode {
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  return isMac ? "⌘" : "Ctrl";
}

function Key({ children }: { children: React.ReactNode }): React.ReactNode {
  const { theme } = useThemeStore();
  return (
    <Paper
      // component="kbd"
      elevation={21}
      sx={{
        fontSize: "inherit",
        color: "inherit",
        border: `1px solid`,
        px: 1,
        borderRadius: theme.shape.borderRadius,
        fontFamily: "monospace",
      }}
    >
      {children}
    </Paper>
  );
}

export const KeyboardShortcut: React.FC<{ shortcut: string }> = ({
  shortcut,
}) => {
  return <>{renderShortcut(shortcut)}</>;
};
