import React, { useEffect, useMemo } from "react";
import {
  Box,
  Chip,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
} from "@mui/material";
import {
  useSearchFilterStore,
  type SearchFilterMode,
  type SearchFilterScope,
  ROOT_SENTINEL_ID,
} from "../../zustand/useSearchFilterStore";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useThemeStore } from "../../zustand/useThemeStore";
import { colorFromString } from "../../utils/blendWithContrast";
import { M3 } from "../../statics";

/**
 * Combined filter surface for the search overlay.
 *
 * Renders the mode selector (`All / Include / Exclude`) and, when
 * the mode isn't `all`, the directory multi-select next to it. State
 * lives in `useSearchFilterStore` so the search overlay and any
 * future callers can read/write the same filter without prop-drilling.
 */
export const SearchFilter: React.FC = () => {
  const { theme } = useThemeStore();
  const { directoriesById, setDirectories } = useDirectoryStore();

  // All directories come from the dedicated directory query so the user
  // can pick a filter scope even before search results resolve.
  // Mirrored into the store so chip labels resolve via `directoriesById`.
  const { data: directoriesData } = useDirectoriesQuery(
    { limit: 500, offset: 0 },
    true,
  );
  useEffect(() => {
    if (directoriesData) {
      setDirectories(directoriesData);
    }
  }, [directoriesData, setDirectories]);

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
  const setFilterMode = useSearchFilterStore((s) => s.setFilterMode);
  const setSelectedDirs = useSearchFilterStore((s) => s.setSelectedDirs);
  const setFilterScope = useSearchFilterStore((s) => s.setFilterScope);

  return (
    <Stack
      direction="row"
      spacing={M3}
      useFlexGap
      sx={{ width: 0.5, alignItems: "center" }}
    >
      <FormControl size="small" sx={{ width: 5 / 13 }}>
        <InputLabel id="search-dir-mode-label">Directories</InputLabel>
        <Select
          labelId="search-dir-mode-label"
          label="Directories"
          value={mode}
          onChange={(e) => setFilterMode(e.target.value as SearchFilterMode)}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="include">Include</MenuItem>
          <MenuItem value="exclude">Exclude</MenuItem>
        </Select>
      </FormControl>

      {mode !== "all" && (
        <>
          <FormControl size="small" sx={{ width: 5 / 13 }}>
            <InputLabel id="search-dir-list-label">Directories</InputLabel>
            <Select
              labelId="search-dir-list-label"
              label="Directories"
              multiple
              value={selectedDirs}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedDirs(typeof v === "string" ? v.split(",") : v);
              }}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((dirId) => {
                    const dir = directoriesById[dirId];
                    const label =
                      dirId === ROOT_SENTINEL_ID
                        ? "root"
                        : dir?.display_name || dir?.name || dirId;
                    const accent = colorFromString(dirId, theme);
                    return (
                      <Chip
                        key={dirId}
                        label={label}
                        size="small"
                        sx={{
                          borderRadius: "1rem",
                          color: accent,
                          border: `1px solid ${accent}`,
                          bgcolor: "transparent",
                        }}
                      />
                    );
                  })}
                </Box>
              )}
            >
              <MenuItem value={ROOT_SENTINEL_ID}>
                <Checkbox
                  checked={selectedDirs.indexOf(ROOT_SENTINEL_ID) !== -1}
                />
                <ListItemText primary="root" />
              </MenuItem>
              {sortedDirectories.map((dir) => {
                const label = dir.display_name || dir.name || dir.id;
                return (
                  <MenuItem key={dir.id} value={dir.id}>
                    <Checkbox checked={selectedDirs.indexOf(dir.id) !== -1} />
                    <ListItemText primary={label} />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ width: 3 / 13 }}>
            <InputLabel id="search-dir-scope-label">Scope</InputLabel>
            <Select
              labelId="search-dir-scope-label"
              label="Scope"
              value={scope}
              onChange={(e) =>
                setFilterScope(e.target.value as SearchFilterScope)
              }
            >
              <MenuItem value="direct">Direct</MenuItem>
              <MenuItem value="subtree">Subtree</MenuItem>
            </Select>
          </FormControl>
        </>
      )}
    </Stack>
  );
};

export default SearchFilter;
