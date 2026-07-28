import React, { useEffect } from "react";
import { Button } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import SearchResultsOverlay from "./Main";
import { isCtrlPlus } from "../../utils/CtrlPlus";
import { KeyboardShortcut } from "../../utils/renderShortcut";

// top-bar button that opens the search dialog with Ctrl+K
export const SearchBar: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const isDialogOpen = useSearchNotesStore((s) => s.isDialogOpen);
  const setIsDialogOpen = useSearchNotesStore((s) => s.setIsDialogOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCtrlPlus(event, "k")) {
        event.preventDefault();
        setIsDialogOpen(!isDialogOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen, setIsDialogOpen]);

  return (
    <>
      <Button
        variant="text"
        onClick={() => setIsDialogOpen(true)}
        sx={{
          border: `1px solid ${theme.palette.primary.main}`,
          justifyContent: "space-between",
          borderRadius: theme.shape.borderRadius,
          p: 1,
          px: 2,
          width: `clamp(400px, 30%, 600px)`,
        }}
      >
        <SearchIcon /> Search <KeyboardShortcut shortcut="ctrl+k" />
      </Button>

      <SearchResultsOverlay
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
};

export default SearchBar;