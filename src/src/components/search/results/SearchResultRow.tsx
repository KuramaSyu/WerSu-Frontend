import React, { memo, useMemo } from "react";
import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { formatDistanceToNowStrict } from "date-fns";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { useUsersStore } from "../../../zustand/userStore";
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
    const users = useUsersStore((s) => s.users);

    // recompute expensive bits only when their inputs change
    const author = users[note.author_id]?.username ?? "unknown";
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
            <Chip label={author} variant="outlined" size="small" />
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
