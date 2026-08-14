import React, { useEffect, useRef } from "react";
import { Box, InputAdornment, Stack, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useSearchFilterStore } from "../../../zustand/useSearchFilterStore";
import SearchStrategySelect from "../../SearchStrategySelect";
import { M3, M4 } from "../../../statics";
import { useDebouncedSearchSync } from "./SearchOverlayHeader.hook";
import { isCtrlPlus } from "../../../utils/CtrlPlus";

interface Props {
  // Kept on the interface so callers don't break when they still
  // pass an `onClose`. The close affordance itself lives on the
  // mobile drawer's swipe handle / backdrop tap, and on the
  // desktop backdrop click / ESC keyboard handler.
  onClose: () => void;
}

// Search input with the strategy picker (keyword / typo-tolerant
// / context) sitting right next to it. Two siblings in a row
// instead of nesting the picker inside the input's adornment --
// keeps both controls at their natural widths and avoids the
// toggle group stealing vertical space from the input.
// subscribes only to `search` + `searchType` so keystrokes don't
// ripple into the filter or results list
export const SearchOverlayHeader: React.FC<Props> = () => {
  const search = useSearchFilterStore((s) => s.search);
  const searchType = useSearchFilterStore((s) => s.searchType);
  const setSearch = useSearchFilterStore((s) => s.setSearch);
  const setSearchType = useSearchFilterStore((s) => s.setSearchType);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useDebouncedSearchSync(search);

  // When the overlay is already open, Ctrl+K re-focuses the
  // search input instead of toggling the overlay (the open
  // half of the shortcut is owned by `SearchBar`). The handler
  // is mounted only while this header is in the tree, so the
  // focus branch only fires when the overlay is open.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCtrlPlus(event, "k")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        gap: M3,
        position: "sticky",
      }}
    >
      <TextField
        autoFocus
        placeholder="Search"
        variant="outlined"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        color="primary"
        sx={{ flex: 1, minWidth: 0 }}
        inputRef={inputRef}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: "1rem" }} />
              </InputAdornment>
            ),
            sx: {
              borderRadius: M4,
              "& .MuiOutlinedInput-input": {
                padding: "calc(1em / 1.6) 0.5rem",
              },
            },
          },
        }}
      />
      <Box sx={{ flexShrink: 0, width: 5 / 13 }}>
        <SearchStrategySelect
          searchType={searchType}
          setSearchType={setSearchType}
          color="primary"
        />
      </Box>
    </Stack>
  );
};

export default SearchOverlayHeader;
