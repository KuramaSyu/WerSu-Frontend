import React, { useMemo, useState } from "react";
import type { Theme } from "@mui/material/styles";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import FolderIcon from "@mui/icons-material/Folder";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import {
  useSearchFilterStore,
  type SearchFilterMode,
  ROOT_SENTINEL_ID,
} from "../../../zustand/useSearchFilterStore";
import { useAllDirectoriesQuery } from "../../../api/queries/directoryQueries";
import { M2, M3 } from "../../../statics";
import { directoryChipLabel, dirLabel } from "./filterLabels";

type OpenMenu = "mode" | "directories" | "scope" | null;

// Compact chip that opens a menu/popover. Active chips show their
// selected value and offer an inline clear affordance.
interface FilterChipProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  tooltip: string;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  onClear?: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({
  icon,
  label,
  active,
  tooltip,
  onClick,
  onClear,
}) => (
  <Chip
    icon={<Box component="span" sx={{ display: "flex" }}>{icon}</Box>}
    label={label}
    title={tooltip}
    aria-label={tooltip}
    aria-haspopup="true"
    size="small"
    variant="outlined"
    color={active ? "primary" : "default"}
    onClick={onClick}
    onDelete={onClear}
    deleteIcon={<CloseIcon />}
    sx={{
      maxWidth: { xs: "100%", sm: 220 },
      borderRadius: "999px",
      // Keep the chips compact even with long directory names.
      "& .MuiChip-icon": { ml: 0.75, mr: -0.25, fontSize: "1rem" },
      "& .MuiChip-label": {
        px: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
      "& .MuiChip-deleteIcon": { ml: 0, mr: 0.75, fontSize: "0.95rem" },
      ...(active
        ? {
            borderColor: "primary.main",
            bgcolor: (theme: Theme) =>
              alpha(theme.palette.primary.main, 0.08),
          }
        : undefined),
    }}
  />
);

const MODE_LABEL: Record<SearchFilterMode, string> = {
  all: "Books & chapters",
  include: "Include",
  exclude: "Exclude",
};

// Directory mode/scope filter for the search overlay. Renders as
// small chips; each chip opens its options in a menu/popover.
export const SearchFilter: React.FC = () => {
  // fetch every directory up front so the user can pick a filter
  // scope before results resolve; chip labels resolve via the byId
  // map the hook already returns.
  const {
    list: directoriesData,
    byId: directoriesById,
    isLoading: directoriesLoading,
  } = useAllDirectoriesQuery();

  const sortedDirectories = useMemo(() => {
    if (!directoriesData) return [];
    return [...directoriesData].sort((a, b) => {
      const aName = a.display_name || a.name || a.id;
      const bName = b.display_name || b.name || b.id;
      return aName.localeCompare(bName);
    });
  }, [directoriesData]);

  const mode = useSearchFilterStore((s) => s.filter.mode);
  const scope = useSearchFilterStore((s) => s.filter.scope);
  const selectedDirs = useSearchFilterStore((s) => s.filter.selectedDirs);
  const setFilter = useSearchFilterStore((s) => s.setFilter);
  const setFilterScope = useSearchFilterStore((s) => s.setFilterScope);

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [dirQuery, setDirQuery] = useState("");

  const openFilter = (
    kind: Exclude<OpenMenu, null>,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    setAnchorEl(event.currentTarget);
    setOpenMenu(kind);
    if (kind === "directories") setDirQuery("");
  };
  // Closing the folder picker without picking anything must not leave
  // an include filter that matches nothing.
  const closeFilter = () => {
    setOpenMenu(null);
    if (mode === "include" && selectedDirs.length === 0) {
      setFilter({ mode: "all" });
    }
  };

  // Choosing include without any directory selected would match
  // nothing, so send the user straight into the picker.
  const handleModeChange = (next: SearchFilterMode) => {
    setFilter({ mode: next });
    if (next === "include" && selectedDirs.length === 0) {
      setOpenMenu("directories");
      return;
    }
    closeFilter();
  };

  // Picking folders while the filter is off switches it to include.
  // Removing the last folder also resets the mode: an empty
  // include/exclude selection has no useful meaning.
  const handleToggleDir = (id: string) => {
    const next = selectedDirs.includes(id)
      ? selectedDirs.filter((dirId) => dirId !== id)
      : [...selectedDirs, id];
    if (next.length === 0) {
      setFilter({ selectedDirs: [], mode: "all", scope: "direct" });
      return;
    }
    setFilter({ selectedDirs: next, mode: mode === "all" ? "include" : mode });
  };

  const clearDirs = () =>
    setFilter({ selectedDirs: [], mode: "all", scope: "direct" });

  const filteredDirectories = useMemo(() => {
    const query = dirQuery.trim().toLowerCase();
    const rootMatches = "root".includes(query);
    return {
      root: rootMatches,
      dirs: sortedDirectories.filter((dir) => {
        if (!query) return true;
        const label = dir.display_name || dir.name || dir.id;
        return label.toLowerCase().includes(query);
      }),
    };
  }, [sortedDirectories, dirQuery]);

  return (
    <Stack
      direction="row"
      spacing={M2}
      useFlexGap
      sx={{ alignItems: "center", flexWrap: "wrap", minWidth: 0 }}
    >
      <FilterChip
        icon={<MenuBookIcon />}
        label={MODE_LABEL[mode]}
        active={mode !== "all"}
        tooltip="Filter by books & chapters"
        onClick={(event) => openFilter("mode", event)}
        onClear={mode === "all" ? undefined : clearDirs}
      />

      <FilterChip
        icon={<FolderIcon />}
        label={directoryChipLabel(selectedDirs, directoriesById)}
        active={selectedDirs.length > 0}
        tooltip="Filter by folders"
        onClick={(event) => openFilter("directories", event)}
        onClear={selectedDirs.length === 0 ? undefined : clearDirs}
      />

      {selectedDirs.length > 0 && (
        <FilterChip
          icon={<AccountTreeIcon />}
          label={scope === "subtree" ? "Subtree" : "Direct"}
          active={scope === "subtree"}
          tooltip="Filter by folder depth"
          onClick={(event) => openFilter("scope", event)}
          onClear={
            scope === "direct" ? undefined : () => setFilterScope("direct")
          }
        />
      )}

      <Menu
        open={openMenu === "mode"}
        anchorEl={anchorEl}
        onClose={closeFilter}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {(
          [
            ["all", "All books & chapters"],
            ["include", "Only in selected"],
            ["exclude", "Not in selected"],
          ] as const
        ).map(([value, label]) => (
          <MenuItem
            key={value}
            selected={mode === value}
            onClick={() => handleModeChange(value)}
          >
            <Box sx={{ width: 24, display: "flex", flexShrink: 0 }}>
              {mode === value && <CheckIcon fontSize="small" />}
            </Box>
            {label}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        open={openMenu === "scope"}
        anchorEl={anchorEl}
        onClose={closeFilter}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {(
          [
            ["direct", "Direct only"],
            ["subtree", "Include subfolders"],
          ] as const
        ).map(([value, label]) => (
          <MenuItem
            key={value}
            selected={scope === value}
            onClick={() => {
              setFilterScope(value);
              closeFilter();
            }}
          >
            <Box sx={{ width: 24, display: "flex", flexShrink: 0 }}>
              {scope === value && <CheckIcon fontSize="small" />}
            </Box>
            {label}
          </MenuItem>
        ))}
      </Menu>

      <Popover
        open={openMenu === "directories"}
        anchorEl={anchorEl}
        onClose={closeFilter}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: { xs: "min(22rem, 85vw)", sm: "22rem" },
              maxHeight: 380,
              display: "flex",
              flexDirection: "column",
              borderRadius: M3,
            },
          },
        }}
      >
        <Box sx={{ p: M2 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Search books & chapters"
            value={dirQuery}
            onChange={(e) => setDirQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
        <Divider />
        <List dense sx={{ overflowY: "auto", flex: 1, py: 0 }}>
          {filteredDirectories.root && (
            <ListItemButton
              onClick={() => handleToggleDir(ROOT_SENTINEL_ID)}
              sx={{ py: 0.25 }}
            >
              <Checkbox
                edge="start"
                size="small"
                disableRipple
                checked={selectedDirs.includes(ROOT_SENTINEL_ID)}
                onClick={(event) => event.stopPropagation()}
                onChange={() => handleToggleDir(ROOT_SENTINEL_ID)}
              />
              <ListItemText primary="root" />
            </ListItemButton>
          )}
          {filteredDirectories.dirs.map((dir) => {
            const label = dirLabel(dir.id, directoriesById);
            return (
              <ListItemButton
                key={dir.id}
                onClick={() => handleToggleDir(dir.id)}
                sx={{ py: 0.25 }}
              >
                <Checkbox
                  edge="start"
                  size="small"
                  disableRipple
                  checked={selectedDirs.includes(dir.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => handleToggleDir(dir.id)}
                />
                <ListItemText
                  primary={label}
                  sx={{
                    minWidth: 0,
                    "& .MuiListItemText-primary": {
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
          {!filteredDirectories.root &&
            filteredDirectories.dirs.length === 0 && (
              <Typography
                variant="body2"
                sx={{ px: M3, py: M2, color: "text.secondary" }}
              >
                {directoriesLoading ? "Loading folders…" : "No folders found"}
              </Typography>
            )}
        </List>
        <Divider />
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", p: M2 }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {selectedDirs.length} selected
          </Typography>
          <Button
            size="small"
            variant="text"
            disabled={selectedDirs.length === 0}
            onClick={clearDirs}
          >
            Clear
          </Button>
        </Stack>
      </Popover>
    </Stack>
  );
};

export default SearchFilter;
