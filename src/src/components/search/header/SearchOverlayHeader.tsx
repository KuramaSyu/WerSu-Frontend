import React, { useEffect, useRef } from "react";
import { InputAdornment, Stack, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useSearchFilterStore } from "../../../zustand/useSearchFilterStore";
import SearchStrategySelect from "../../SearchStrategySelect";
import { M2, M3, M4 } from "../../../statics";
import { useDebouncedSearchSync } from "./SearchOverlayHeader.hook";
import { isCtrlPlus } from "../../../utils/CtrlPlus";
import { SearchTypeOverrideHint } from "./SearchTypeOverrideHint";

interface Props {
  // Kept so callers still passing onClose don't break; the actual
  // close affordance lives on the drawer's swipe handle / backdrop.
  onClose: () => void;
}

// Search input with strategy picker as a sibling, not an adornment.
// Subscribes to search + searchType only so keystrokes don't ripple.
export const SearchOverlayHeader: React.FC<Props> = () => {
  const search = useSearchFilterStore((s) => s.search);
  const searchType = useSearchFilterStore((s) => s.searchType);
  const setSearch = useSearchFilterStore((s) => s.setSearch);
  const setSearchType = useSearchFilterStore((s) => s.setSearchType);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useDebouncedSearchSync(search);

  // When the overlay is open, Ctrl+K re-focuses the input; the open
  // half is owned by SearchBar. Mounted only while header is mounted.
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
      <Stack
        direction="row"
        sx={{
          flexShrink: 0,
          alignItems: "center",
          gap: M2,
        }}
      >
        <SearchStrategySelect
          searchType={searchType}
          setSearchType={setSearchType}
          color="primary"
        />
        <SearchTypeOverrideHint current={searchType} />
      </Stack>
    </Stack>
  );
};

export default SearchOverlayHeader;
