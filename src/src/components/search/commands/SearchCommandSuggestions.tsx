import React from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SearchCommandSuggestion } from "./searchCommands";

interface Props {
  suggestions: SearchCommandSuggestion[];
  selectedIndex: number;
  onPick: (suggestion: SearchCommandSuggestion) => void;
  onHover: (index: number) => void;
}

// Dropdown rendered under the search input while the user types a
// slash command. Keyboard handling lives in SearchOverlayHeader so the
// input keeps focus; this component only renders and reports picks.
export const SearchCommandSuggestions: React.FC<Props> = ({
  suggestions,
  selectedIndex,
  onPick,
  onHover,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <Paper
      elevation={1}
      sx={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        right: 0,
        zIndex: 1400,
        maxHeight: 280,
        overflowY: "auto",
        borderRadius: 2,
        // Paper tone darkened a touch so the menu reads as a distinct
        // surface without the heavy elevation shadow.
        backgroundColor: (theme) => theme.palette.background.paper,
        backgroundImage: (theme) =>
          `linear-gradient(${alpha(theme.palette.common.black, 0.14)}, ${alpha(
            theme.palette.common.black,
            0.14,
          )})`,
        border: (theme) =>
          `1px solid ${alpha(theme.palette.divider, 0.2)}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: "block",
          px: 2,
          pt: 1,
          pb: 0.5,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Commands · Tab to complete · Enter to run
      </Typography>
      <List dense disablePadding>
        {suggestions.map((suggestion, index) => (
          <ListItemButton
            key={suggestion.id}
            selected={index === selectedIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(suggestion)}
            onMouseEnter={() => onHover(index)}
            sx={{ alignItems: "flex-start", py: 0.75 }}
          >
            <ListItemText
              primary={suggestion.label}
              secondary={suggestion.hint}
              slotProps={{
                primary: {
                  sx: {
                    fontFamily: "monospace",
                    fontWeight: 600,
                  },
                },
                secondary: {
                  sx: { whiteSpace: "normal" },
                },
              }}
            />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ height: 4 }} />
    </Paper>
  );
};

export default SearchCommandSuggestions;
