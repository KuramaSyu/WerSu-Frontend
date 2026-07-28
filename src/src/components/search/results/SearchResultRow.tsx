import React, { memo, useMemo } from "react";
import {
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { formatDistanceToNowStrict } from "date-fns";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { useDirectoryStore } from "../../../zustand/useDirectoryStore";
import { colorFromString } from "../../../utils/blendWithContrast";
import { M2, M3 } from "../../../statics";
import { highlightSearchMatch } from "../SearchResultHighlights";
import { Note, type RestNotesSearchType } from "../../../api/models/search";

interface Props {
  note: Note;
  index: number;
  isSelected: boolean;
  hoverEnabled: boolean;
  searchQuery: string;
  searchType: RestNotesSearchType;
  onSelect: (index: number) => void;
  onNavigate: (noteId: string) => void;
}

// walk a directory id up to root, returning [root, ..., dir]; capped to
// avoid pathological loops in malformed graphs
const buildPath = (
  startId: string,
  directoriesById: Record<
    string,
    { parent_dir_ids?: string[]; display_name?: string; name?: string }
  >,
): string[] => {
  const chain: string[] = [];
  const seen = new Set<string>();
  let id: string | undefined = startId;
  while (id && !seen.has(id)) {
    seen.add(id);
    chain.unshift(id);
    const dir: { parent_dir_ids?: string[] } | undefined = directoriesById[id];
    if (!dir) break;
    const parent: string | undefined = dir.parent_dir_ids?.[0];
    id = parent;
    if (chain.length > 32) break;
  }
  return chain;
};

// label for a directory id: display_name preferred, else name, else id
const directoryLabel = (
  id: string,
  directoriesById: Record<string, { display_name?: string; name?: string }>,
): string => {
  const dir = directoriesById[id];
  if (!dir) return id;
  return dir.display_name || dir.name || id;
};

// single result row; memoized so arrow-key navigation doesn't remount
// the 14 neighbouring rows
export const SearchResultRow: React.FC<Props> = memo(
  ({
    note,
    index,
    isSelected,
    hoverEnabled,
    searchQuery,
    searchType,
    onSelect,
    onNavigate,
  }) => {
    const theme = useThemeStore((s) => s.theme);
    const directoriesById = useDirectoryStore((s) => s.directoriesById);

    // root-level orphan note: no parent dirs, no path to walk
    const dirId = note.get_dir() ?? "root";
    const { chipLabel, pathTip } = useMemo(() => {
      if (dirId === "root" || !directoriesById[dirId]) {
        return { chipLabel: "root", pathTip: "root" };
      }
      const chain = buildPath(dirId, directoriesById);
      return {
        chipLabel: directoryLabel(dirId, directoriesById),
        pathTip: chain
          .map((id) => directoryLabel(id, directoriesById))
          .join(" / "),
      };
    }, [dirId, directoriesById]);

    const timestamp = formatDistanceToNowStrict(new Date(note.updated_at), {
      addSuffix: true,
    });
    const highlight = useMemo(
      () =>
        highlightSearchMatch({
          content: note.stripped_content,
          query: searchQuery,
          searchType,
          contextChars: 100,
          theme,
        }),
      [note.stripped_content, searchQuery, searchType, theme],
    );

    return (
      <Paper
        data-search-index={index}
        elevation={isSelected ? 5 : 1}
        onMouseEnter={() => {
          if (hoverEnabled) onSelect(index);
        }}
        onClick={() => onNavigate(note.id)}
        sx={{
          p: M2,
          pl: M3,
          borderLeft: `5px solid ${colorFromString(note.get_dir() || "root", theme)}`,
          cursor: "pointer",
          transition: "all 0.2s ease",
          transform: isSelected ? "translateX(6px)" : "none",
          display: "flex",
          flexDirection: "row",
          gap: M2,
        }}
      >
        <Box className="note.header" sx={{ minWidth: 3 / 8 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: "bold",
              mb: M2,
              color: theme.palette.text.primary,
            }}
          >
            {note.title}
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mb: M2, minWidth: 5 / 8 }}>
            <Tooltip title={pathTip} placement="top" arrow>
              <Chip label={chipLabel} variant="outlined" size="small" />
            </Tooltip>
            <Chip label={timestamp} variant="outlined" size="small" />
          </Stack>
        </Box>

        <Divider orientation="vertical" flexItem />
        {highlight}
      </Paper>
    );
  },
);

SearchResultRow.displayName = "SearchResultRow";

export default SearchResultRow;
