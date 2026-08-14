import React, { memo, useEffect } from "react";
import { ToggleButtonGroup, Box, Stack, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { M4 } from "../statics";
import { RestNotesSearchType } from "../api/models/search";
import CollapseToggleButton from "./CollapseToggleButton";
import { KeyboardShortcut } from "../utils/renderShortcut";
import { isCtrlPlus } from "../utils/CtrlPlus";
import { ShortcutHint } from "./ShortcutHint";

// Map shortcut key -> search type. Kept at module scope so the
// keyboard handler and the hint labels stay in sync. The keys
// here are the exact set passed to `isCtrlPlus` in the listener
// below; add a row and a new pill at once.
const STRATEGY_SHORTCUTS: Record<string, RestNotesSearchType> = {
  q: RestNotesSearchType.KEYWORD,
  w: RestNotesSearchType.TYPO_TOLERANT,
  e: RestNotesSearchType.CONTEXT,
};

// Display order for the single hint popover anchored to the
// group. Matches the left-to-right pill order in the toggle.
const STRATEGY_KEYS: string[] = ["q", "w", "e"];
const STRATEGY_LABELS: Record<string, string> = {
  q: "Keyword",
  w: "Fuzzy",
  e: "Context",
};

interface Props {
  searchType: RestNotesSearchType;
  setSearchType: (t: RestNotesSearchType) => void;
  color: "primary" | "secondary" | "standard" | "error" | "info" | "success";
}

const SearchStrategySelect: React.FC<Props> = ({
  searchType,
  setSearchType,
  color,
}) => {
  // Wire up Ctrl+Alt+Q / Ctrl+Alt+W / Ctrl+Alt+E while the
  // picker is mounted. The Alt chord puts the binding outside
  // plain-Ctrl shortcuts (Ctrl+W closes the tab), so
  // `preventDefault` is sufficient to own them. `isCtrlPlus`
  // accepts the key list as an array so a single guard handles
  // all three.
  useEffect(() => {
    const keys = Object.keys(STRATEGY_SHORTCUTS);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCtrlPlus(event, keys, { alt: true })) return;
      const next = STRATEGY_SHORTCUTS[event.key.toLowerCase()];
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      setSearchType(next);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSearchType]);

  // Single hint popover for the whole group. Three shortcut
  // chips side-by-side (`Ctrl + Alt + Q`, `Ctrl + Alt + W`,
  // `Ctrl + Alt + E`) so the user learns all three without any
  // extra text -- the toggle pills already name the modes.
  const groupHint = (
    <Stack direction="column" spacing={1}>
      {STRATEGY_KEYS.map((key) => (
        <Stack direction="row" spacing={1}>
          <KeyboardShortcut shortcut={`ctrl+alt+${key}`} />{" "}
          <Typography>{STRATEGY_LABELS[key]}</Typography>
        </Stack>
      ))}
    </Stack>
  );

  return (
    <ShortcutHint body={groupHint} placement="bottom">
      <ToggleButtonGroup
        value={searchType}
        exclusive
        onChange={(_event, newSearchType) => {
          if (newSearchType !== null) {
            setSearchType(newSearchType as RestNotesSearchType);
          }
        }}
        color={color}
        aria-label="search type"
        sx={{
          borderRadius: M4,
          width: "100%",
          py: 0,
          my: 0,
        }}
      >
        <CollapseToggleButton
          whenSelected={<Box sx={{ whiteSpace: "nowrap" }}>Keyword</Box>}
          selected={searchType === RestNotesSearchType.KEYWORD}
          color={color}
          value={RestNotesSearchType.KEYWORD}
          aria-label="keyword"
          sx={{
            borderTopLeftRadius: M4,
            borderBottomLeftRadius: M4,
            gap: 1,
          }}
        >
          <SearchIcon />
        </CollapseToggleButton>
        <CollapseToggleButton
          whenSelected={<Box>Fuzzy</Box>}
          selected={searchType === RestNotesSearchType.TYPO_TOLERANT}
          color={color}
          value={RestNotesSearchType.TYPO_TOLERANT}
          aria-label="typo tolerant"
          sx={{ gap: 1 }}
        >
          <ManageSearchIcon />
        </CollapseToggleButton>
        <CollapseToggleButton
          color={color}
          whenSelected={<Box>Context</Box>}
          selected={searchType === RestNotesSearchType.CONTEXT}
          value={RestNotesSearchType.CONTEXT}
          aria-label="context"
          sx={{
            borderTopRightRadius: M4,
            borderBottomRightRadius: M4,
            gap: 1,
          }}
        >
          <AutoAwesomeIcon />
        </CollapseToggleButton>
      </ToggleButtonGroup>
    </ShortcutHint>
  );
};

export default memo(SearchStrategySelect);
