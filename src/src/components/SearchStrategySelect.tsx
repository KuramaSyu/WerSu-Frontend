import React, { memo, useEffect } from "react";
import {
  ToggleButtonGroup,
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import { M2, M4 } from "../statics";
import { RestNotesSearchType } from "../api/models/search";
import CollapseToggleButton from "./CollapseToggleButton";
import { KeyboardShortcut } from "../utils/renderShortcut";
import { isCtrlPlus } from "../utils/CtrlPlus";
import { ShortcutHint } from "./ShortcutHint";
import { useBreakpoint } from "../hooks/useBreakpoint";

// One row per search mode. Kept at module scope so the toggle
// group, the mobile menu and the Ctrl+Alt shortcut handler all
// read from the same source. The `key` is the exact key passed
// to `isCtrlPlus` below; add a row and a new menu entry at once.
interface Strategy {
  type: RestNotesSearchType;
  key: string;
  label: string;
  icon: React.ReactElement;
}

const STRATEGIES: Strategy[] = [
  {
    type: RestNotesSearchType.KEYWORD,
    key: "q",
    label: "Keyword",
    icon: <SearchIcon />,
  },
  {
    type: RestNotesSearchType.TYPO_TOLERANT,
    key: "w",
    label: "Fuzzy",
    icon: <ManageSearchIcon />,
  },
  {
    type: RestNotesSearchType.CONTEXT,
    key: "e",
    label: "Context",
    icon: <AutoAwesomeIcon />,
  },
];

const STRATEGY_SHORTCUTS: Record<string, RestNotesSearchType> =
  Object.fromEntries(STRATEGIES.map((s) => [s.key, s.type]));

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
  const { isMobile } = useBreakpoint();
  // Anchor for the mobile menu; null keeps it closed.
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);

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
      {STRATEGIES.map((strategy) => (
        <Stack key={strategy.key} direction="row" spacing={1}>
          <KeyboardShortcut shortcut={`ctrl+alt+${strategy.key}`} />{" "}
          <Typography>{strategy.label}</Typography>
        </Stack>
      ))}
    </Stack>
  );

  // Mobile: the three-pill toggle is too wide for the drawer
  // header, so collapse it into a single button that opens a menu.
  // The compact button shows only the active mode's icon; the menu
  // spells out every option with the current one checked.
  if (isMobile) {
    const active = STRATEGIES.find((s) => s.type === searchType) ?? STRATEGIES[0];
    return (
      <>
        <Button
          variant="outlined"
          color={color === "standard" ? "primary" : color}
          size="small"
          aria-label={`Search mode: ${active.label}`}
          aria-haspopup="menu"
          aria-expanded={menuAnchor ? "true" : undefined}
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          startIcon={active.icon}
          endIcon={<ArrowDropDownIcon />}
          sx={{
            flexShrink: 0,
            borderRadius: M4,
            px: 1,
            py: 0.25,
            minWidth: 0,
            whiteSpace: "nowrap",
            "& .MuiButton-startIcon": { mr: 0.5 },
          }}
        >
          {active.label}
        </Button>
        <Menu
          open={Boolean(menuAnchor)}
          anchorEl={menuAnchor}
          onClose={() => setMenuAnchor(null)}
          // The search header raises itself above the drawer; keep
          // the menu above it too, otherwise it paints underneath.
          sx={{ zIndex: (theme) => theme.zIndex.modal + 3 }}
          slotProps={{
            paper: { sx: { minWidth: 220, borderRadius: 3, py: 0.5 } },
          }}
        >
          {STRATEGIES.map((strategy) => (
            <MenuItem
              key={strategy.type}
              selected={strategy.type === searchType}
              onClick={() => {
                setSearchType(strategy.type);
                setMenuAnchor(null);
              }}
              sx={{ gap: M2 }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: "text.secondary" }}>
                {strategy.icon}
              </ListItemIcon>
              <ListItemText primary={strategy.label} />
              {strategy.type === searchType && (
                <CheckIcon fontSize="small" sx={{ color: "primary.main" }} />
              )}
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }

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
        {STRATEGIES.map((strategy, index) => (
          <CollapseToggleButton
            key={strategy.type}
            whenSelected={
              <Box sx={{ whiteSpace: "nowrap" }}>{strategy.label}</Box>
            }
            selected={searchType === strategy.type}
            color={color}
            value={strategy.type}
            aria-label={strategy.label.toLowerCase()}
            sx={{
              borderTopLeftRadius: index === 0 ? M4 : undefined,
              borderBottomLeftRadius: index === 0 ? M4 : undefined,
              borderTopRightRadius:
                index === STRATEGIES.length - 1 ? M4 : undefined,
              borderBottomRightRadius:
                index === STRATEGIES.length - 1 ? M4 : undefined,
              gap: 1,
            }}
          >
            {strategy.icon}
          </CollapseToggleButton>
        ))}
      </ToggleButtonGroup>
    </ShortcutHint>
  );
};

export default memo(SearchStrategySelect);
