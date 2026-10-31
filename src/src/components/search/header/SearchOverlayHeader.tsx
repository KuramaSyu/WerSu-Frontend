import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, InputAdornment, Stack, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useSearchFilterStore } from "../../../zustand/useSearchFilterStore";
import SearchStrategySelect from "../../SearchStrategySelect";
import { M2, M3, M4 } from "../../../statics";
import { useDebouncedSearchSync } from "./SearchOverlayHeader.hook";
import { isCtrlPlus } from "../../../utils/CtrlPlus";
import { SearchTypeOverrideHint } from "./SearchTypeOverrideHint";
import { SearchCommandSuggestions } from "../commands/SearchCommandSuggestions";
import {
  getSearchCommandSuggestions,
  resolveSearchCommand,
  type SearchCommandSuggestion,
} from "../commands/searchCommands";

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

  // Slash-command suggestions for the current input; empty for a
  // normal (non-`/`) query, so the regular search flow is untouched.
  const suggestions = useMemo(
    () => getSearchCommandSuggestions(search),
    [search],
  );
  const [selection, setSelection] = useState({ search: "", index: 0 });
  // The input value the user dismissed with Escape; the menu stays
  // hidden until the text changes again.
  const [dismissedSearch, setDismissedSearch] = useState<string | null>(null);
  const showSuggestions =
    suggestions.length > 0 && dismissedSearch !== search;
  // Derive the highlighted row during render: whenever the search text
  // changes the selection resets to the best match, without an effect.
  const activeIndex =
    selection.search === search
      ? Math.min(selection.index, Math.max(suggestions.length - 1, 0))
      : 0;

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

  // Executes a suggestion: mode commands switch the strategy and clear
  // the input so the user can type the query right away; the bare
  // `/mode` command only completes to `/mode ` and waits for its arg.
  const applySuggestion = useCallback(
    (suggestion: SearchCommandSuggestion) => {
      if (suggestion.searchType && !suggestion.completesOnly) {
        setSearchType(suggestion.searchType);
        setSearch("");
        return;
      }
      setSearch(suggestion.completion);
    },
    [setSearch, setSearchType],
  );

  const moveSelection = (delta: number) => {
    setSelection((prev) => {
      const base = prev.search === search ? prev.index : 0;
      const next = Math.min(
        Math.max(base + delta, 0),
        suggestions.length - 1,
      );
      return { search, index: next };
    });
  };

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (showSuggestions) {
      if (event.key === "Escape") {
        // Dismiss only the command menu; keep the overlay (and the
        // typed text) so Escape doesn't close the whole search.
        event.preventDefault();
        event.stopPropagation();
        setDismissedSearch(search);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        // Prevent the results list's document-level handler from also
        // moving its own selection while the command menu is open.
        event.preventDefault();
        event.stopPropagation();
        moveSelection(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        const suggestion = suggestions[activeIndex];
        if (suggestion) setSearch(suggestion.completion);
        return;
      }
      if (event.key === "Enter") {
        const suggestion = suggestions[activeIndex];
        if (suggestion) {
          event.preventDefault();
          // Without this the results list's document-level Enter handler
          // would open the selected note and close the overlay.
          event.stopPropagation();
          applySuggestion(suggestion);
          return;
        }
      }
    }

    // Fallback: the user typed a full command and the suggestion list is
    // already empty (e.g. `/context foo`). Run it directly.
    if (event.key === "Enter") {
      const resolved = resolveSearchCommand(search);
      if (resolved) {
        event.preventDefault();
        event.stopPropagation();
        setSearchType(resolved.searchType);
        setSearch("");
      }
    }
  };

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        gap: M3,
        position: "sticky",
        // The header owns the slash-command dropdown. Raising the
        // whole header above the filter/results siblings keeps the
        // popup from painting underneath them.
        zIndex: (theme) => theme.zIndex.modal + 2,
      }}
    >
      <Box sx={{ position: "relative", flex: 1, minWidth: 0 }}>
        <TextField
          autoFocus
          fullWidth
          placeholder='Search or type "/" for commands'
          variant="outlined"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleInputKeyDown}
          color="primary"
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
        <SearchCommandSuggestions
          suggestions={showSuggestions ? suggestions : []}
          selectedIndex={activeIndex}
          onPick={applySuggestion}
          onHover={(index) => setSelection({ search, index })}
        />
      </Box>
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
