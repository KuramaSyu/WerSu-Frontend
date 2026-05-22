import React, { useMemo, useEffect } from "react";
import {
  Box,
  Typography,
  Stack,
  Paper,
  CircularProgress,
  Chip,
  alpha,
  Portal,
  IconButton,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useThemeStore } from "../zustand/useThemeStore";
import { useSearchNotesStore } from "../zustand/useSearchNotesStore";
import { RestNotesSearchType, type MinimalNote } from "../api/models/search";
import { M2, M3, M4 } from "../statics";

interface SearchResultHighlightProps {
  content: string;
  query: string;
  searchType: RestNotesSearchType;
  contextChars?: number;
}

/**
 * Extracts context around matches in content and highlights them.
 * For exact/typo-tolerant search, shows 100 chars before and after.
 */
export const highlightSearchMatch = ({
  content,
  query,
  searchType,
  contextChars = 100,
}: SearchResultHighlightProps): React.ReactNode[] => {
  if (!query || !content) return [content];

  if (
    searchType === RestNotesSearchType.KEYWORD ||
    searchType === RestNotesSearchType.TYPO_TOLERANT ||
    searchType === RestNotesSearchType.LATEST ||
    searchType === RestNotesSearchType.CONTEXT
  ) {
    // For keyword and typo-tolerant: find matches and show context
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const matches: { start: number; end: number }[] = [];
    let startIndex = 0;

    // Find all matches
    while (true) {
      const index = lowerContent.indexOf(lowerQuery, startIndex);
      if (index === -1) break;
      matches.push({ start: index, end: index + query.length });
      startIndex = index + 1;
    }

    if (matches.length === 0) return [content];

    const fragments: React.ReactNode[] = [];

    matches.forEach((match, idx) => {
      var contextStart = Math.max(0, match.start - contextChars);
      var contextEnd = Math.min(content.length, match.end + contextChars);

      // Add ellipsis if context is truncated at start
      let contextText = content.substring(contextStart, contextEnd);
      if (contextStart > 0) {
        contextText = "..." + contextText;
        contextStart -= 3; // Adjust match positions for added ellipsis
        contextEnd -= 3;
      }
      if (contextEnd < content.length) {
        contextText = contextText + "...";
      }

      // Find where the match is in the context string
      const matchOffsetInContext = match.start - contextStart;
      const before = contextText.substring(
        0,
        Math.max(0, matchOffsetInContext),
      );
      const matchText = contextText.substring(
        Math.max(0, matchOffsetInContext),
        matchOffsetInContext + query.length,
      );
      const after = contextText.substring(matchOffsetInContext + query.length);

      fragments.push(
        <Box key={`context-${idx}`} sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {before}
            <Box
              component="span"
              sx={{
                backgroundColor: alpha("#FFA500", 0.6),
                color: "#000",
                fontWeight: "bold",
                borderRadius: "2px",
                px: "2px",
              }}
            >
              {matchText}
            </Box>
            {after}
          </Typography>
        </Box>,
      );
    });

    return fragments;
  }

  return [content];
};

export interface SearchResultsOverlayProps {
  open: boolean;
  onClose: () => void;
  isLoading?: boolean;
  searchQuery: string;
  searchType: RestNotesSearchType;
}

/**
 * SearchResultsOverlay displays search results in a modal-like overlay with a backdrop.
 *
 * It supports keyboard dismissal (Escape), click-to-close backdrop behavior,
 * and renders loading, empty, or populated states based on `isLoading` and the
 * current `notes` collection. The overlay also shows metadata such as search
 * type and query, and highlights matches when appropriate.
 *
 * @param open - Whether the overlay is visible.
 * @param onClose - Callback invoked to close the overlay.
 * @param isLoading - Indicates if search results are currently loading.
 * @param searchQuery - The query string used for searching, shown in the header.
 * @param searchType - The search mode used to label results and control highlighting.
 *
 * @returns The overlay UI when open, otherwise `null`.
 */
export const SearchResultsOverlay: React.FC<SearchResultsOverlayProps> = ({
  open,
  onClose,
  isLoading = false,
  searchQuery,
  searchType,
}) => {
  const { theme } = useThemeStore();
  const { notes } = useSearchNotesStore();

  // Handle escape key to close overlay
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Convert notes to array if it's an object
  const notesArray = useMemo(() => {
    if (Array.isArray(notes)) {
      return notes as MinimalNote[];
    }
    return Object.values(notes || {}) as MinimalNote[];
  }, [notes]);

  const getSearchTypeLabel = (type: RestNotesSearchType): string => {
    switch (type) {
      case RestNotesSearchType.KEYWORD:
        return "Keyword";
      case RestNotesSearchType.TYPO_TOLERANT:
        return "Typo Tolerant";
      case RestNotesSearchType.CONTEXT:
        return "Context";
      case RestNotesSearchType.LATEST:
        return "Latest";
      default:
        return type;
    }
  };

  const resultsContent = useMemo(() => {
    if (notesArray.length === 0) {
      return (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography color="textSecondary">
            No results found for "{searchQuery}"
          </Typography>
        </Box>
      );
    }

    return (
      <Stack spacing={M3}>
        {notesArray.map((note: MinimalNote, index: number) => (
          <Paper
            key={`${note.id}-${index}`}
            elevation={1}
            sx={{
              p: M2,
              //   backgroundColor: theme.palette.background.paper,
              borderLeft: `4px solid ${theme.palette.primary.main}`,
              cursor: "pointer",
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                transform: "translateX(4px)",
              },
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: "bold",
                mb: M2,
                color: theme.palette.primary.main,
              }}
            >
              {note.title}
            </Typography>

            <Stack direction="row" spacing={2} sx={{ mb: M2 }}>
              <Typography variant="caption" color="textSecondary">
                By {note.author_id}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {new Date(note.updated_at).toLocaleDateString()}
              </Typography>
            </Stack>

            <Divider sx={{ my: M3 }} />
            {/* Highlight Box */}

            {highlightSearchMatch({
              content: note.stripped_content,
              query: searchQuery,
              searchType,
              contextChars: 100,
            })}
          </Paper>
        ))}
      </Stack>
    );
  }, [isLoading, notesArray, searchQuery, searchType, theme]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop - click to close */}
      <Box
        onClick={onClose}
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: alpha(theme.palette.common.black, 0.2),
          zIndex: 900,
        }}
      />

      {/* Overlay panel */}
      <Portal>
        <Box
          sx={{
            position: "fixed",
            top: "140px", // Below the search bar
            left: "15%",
            right: "15%",
            maxHeight: "66%",
            backgroundColor: theme.palette.background.paper,
            borderRadius: M4,
            boxShadow: theme.shadows[8],
            zIndex: 1300,
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header with close button */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            position={"sticky"}
            m={M3}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                Search Results
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip
                  label={getSearchTypeLabel(searchType)}
                  size="small"
                  variant="outlined"
                />
                {searchQuery && (
                  <Typography variant="caption" sx={{ alignSelf: "center" }}>
                    for "{searchQuery}"
                  </Typography>
                )}
              </Stack>
            </Box>
            {isLoading && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <CircularProgress />
              </Box>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="textSecondary">
                {isLoading ? "Searching..." : `${notesArray.length} results`}
              </Typography>
              <IconButton
                size="medium"
                onClick={onClose}
                sx={{
                  color: theme.palette.text.secondary,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.text.primary, 0.1),
                  },
                }}
              >
                <CloseIcon fontSize="medium" />
              </IconButton>
            </Stack>
          </Stack>
          <Box
            sx={{
              zIndex: 1301,
              flex: 1,
              m: M3,
              overflowY: "auto",
              scrollbarGutter: "stable",
              position: "relative",
            }}
          >
            {/* scrollbar padding */}
            <Box sx={{ width: "98%" }}>
              {/* Results or Loading */}
              {resultsContent}
            </Box>
          </Box>
        </Box>
      </Portal>
    </>
  );
};

export default SearchResultsOverlay;
