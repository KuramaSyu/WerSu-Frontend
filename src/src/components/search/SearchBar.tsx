import React, { useEffect } from "react";
import { Button, Stack, Typography, alpha } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import SearchResultsOverlay from "./Main";
import { isCtrlPlus } from "../../utils/CtrlPlus";
import { KeyboardShortcut } from "../../utils/renderShortcut";

// Side-rail button that opens the search dialog with Ctrl+K.
// The button fills its container (`width: 100%`) so it adapts to
// whatever rail width is in effect -- narrow when the rail is
// collapsed, full when the rail is open. Border + text colour use
// `text.primary` so it stays readable on the rail's
// `background.default` surface (the previous topbar-tuned
// `topbarContrastText` resolved to a white-ish tone in light mode
// and disappeared against the light rail background).
//
// Ctrl+K while the overlay is open is handled by
// `SearchOverlayHeader` (it refocuses the input). Here we only
// open the overlay — closing still happens via ESC, the backdrop
// tap, or the drawer's swipe-down gesture.
export const SearchBar: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const isDialogOpen = useSearchNotesStore((s) => s.isDialogOpen);
  const setIsDialogOpen = useSearchNotesStore((s) => s.setIsDialogOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCtrlPlus(event, "k")) return;
      event.preventDefault();
      if (!isDialogOpen) {
        setIsDialogOpen(true);
      }
      // If already open, the inner SearchOverlayHeader handler
      // will focus the input. Letting this handler fall through
      // would close the overlay right after it opens.
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen, setIsDialogOpen]);

  return (
    <>
      <Button
        variant="outlined"
        onClick={() => setIsDialogOpen(true)}
        size="small"
        sx={{
          color: theme.palette.text.primary,
          textTransform: "none",
          justifyContent: "space-between",
          p: 0.5,
          px: 1.75,
          width: "clamp(12.5rem, 20vw, 25rem)",
          minWidth: 0,
          minHeight: 40,
          fontWeight: 600,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          backgroundColor: alpha(
            theme.palette.primary.main,
            theme.palette.mode === "dark" ? 0.07 : 0.045,
          ),
          "&:hover": {
            borderColor: theme.palette.text.disabled,
            backgroundColor: alpha(
              theme.palette.primary.main,
              theme.palette.mode === "dark" ? 0.11 : 0.075,
            ),
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flex: 1, minWidth: 0 }}
        >
          <SearchIcon
            fontSize="small"
            sx={{ color: theme.palette.primary.main, flexShrink: 0 }}
          />
          <Typography
            variant="body2"
            noWrap
            sx={{
              color: theme.palette.primary.main,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Search
          </Typography>
        </Stack>
        <KeyboardShortcut
          shortcut="ctrl+k"
          accentColor={theme.palette.primary.main}
        />
      </Button>

      <SearchResultsOverlay
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
};

export default SearchBar;
