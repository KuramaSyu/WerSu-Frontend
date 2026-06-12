import React, { useMemo, useEffect, useState } from "react";
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
  Fade,
  Grow,
  Collapse,
  Input,
  TextField,
  InputAdornment,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useThemeStore } from "../zustand/useThemeStore";
import { useSearchNotesStore } from "../zustand/useSearchNotesStore";
import { RestNotesSearchType, type MinimalNote } from "../api/models/search";
import { M2, M3, M4 } from "../statics";
import { useInfiniteNoteSearch } from "../api/queries/useNoteQueries";
import { SearchNotesApi } from "../api/SearchNotesApi";
import SearchStrategySelect from "./SearchStrategySelect";
import SearchIcon from "@mui/icons-material/Search";

interface SearchResultHighlightProps {
  content: string;
  query: string;
  searchType: RestNotesSearchType;
  contextChars?: number;
}

const INITIAL_DEBOUCE_DELAY = 500; // to prevent lag in mode selection
const DEBOUNCE_DELAY = 125;

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
}) => {
  const { theme } = useThemeStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchType, setSearchType] = useState<RestNotesSearchType>(
    RestNotesSearchType.CONTEXT,
  );

  // get results
  const { data } = useInfiniteNoteSearch(searchType, debouncedSearchText, 200);
  const notes = data?.pages.flat() ?? [];
  console.log(
    `Search results for "${debouncedSearchText}" (${searchType}):`,
    notes,
  );

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

  // debouce search input to prevent lags while typings
  useEffect(() => {
    if (!searchActive || searchQuery === "") {
      setDebouncedSearchText(searchQuery);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchQuery);
    }, DEBOUNCE_DELAY);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, searchActive]);

  const resultsContent = useMemo(() => {
    if (notes.length === 0) {
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
        {notes.map((note: MinimalNote, index: number) => (
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

            {searchQuery.length > 2 ? (
              highlightSearchMatch({
                content: note.stripped_content,
                query: searchQuery,
                searchType,
                contextChars: 100,
              })
            ) : (
              <>
                {note.stripped_content.slice(0, 200) +
                  (note.stripped_content.length > 200 ? "..." : "")}
              </>
            )}
          </Paper>
        ))}
      </Stack>
    );
  }, [isLoading, notes, searchQuery, searchType, theme]);

  return (
    <>
      {/* Backdrop - click to close */}
      <Fade
        in={open}
        timeout={theme.transitions.duration.complex}
        mountOnEnter
        unmountOnExit
      >
        <Box
          onClick={onClose}
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: alpha(theme.palette.background.default, 0.66),
            zIndex: 900,
          }}
        />
      </Fade>

      {/* Overlay panel */}
      <Portal>
        <Grow
          in={open}
          timeout={theme.transitions.duration.short}
          mountOnEnter
          unmountOnExit
        >
          <Box
            sx={{
              position: "fixed",
              top: "100px", // Below the search bar
              left: "15%",
              right: "15%",
              maxHeight: "66%",
              backgroundColor: theme.palette.background.paper,
              borderRadius: M3,
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
              <SearchStrategySelect
                searchType={searchType}
                setSearchType={setSearchType}
              />
              {isLoading && (
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <CircularProgress />
                </Box>
              )}

              <TextField
                autoFocus
                placeholder="Search"
                variant="outlined"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                onBlur={() => setSearchActive(false)}
                color="primary"
                sx={{
                  width: "fit-content",
                  minWidth: "33%",
                  maxWidth: "50%",
                }}
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
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="textSecondary">
                  {isLoading ? "Searching..." : `${notes.length} results`}
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
        </Grow>
      </Portal>
    </>
  );
};

export default SearchResultsOverlay;
