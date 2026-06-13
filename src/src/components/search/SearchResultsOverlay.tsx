import React, { useMemo, useEffect, useState, useRef } from "react";
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
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import {
  RestNotesSearchType,
  type MinimalNote,
  Note,
} from "../../api/models/search";
import { M2, M3, M4 } from "../../statics";
import { useInfiniteNoteSearch } from "../../api/queries/useNoteQueries";
import { SearchNotesApi } from "../../api/SearchNotesApi";
import SearchStrategySelect from "../SearchStrategySelect";
import SearchIcon from "@mui/icons-material/Search";
import { highlightSearchMatch } from "./SearchResultHighlights";
import { KeyboardShortcut } from "../../utils/renderShortcut";
import { useUsersStore } from "../../zustand/userStore";
import { formatDistanceToNowStrict } from "date-fns";
import { getDirectoryPath } from "../../utils/getDirectoryPath";

const INITIAL_DEBOUCE_DELAY = 500; // to prevent lag in mode selection
const DEBOUNCE_DELAY = 125;

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
  const { users } = useUsersStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchType, setSearchType] = useState<RestNotesSearchType>(
    RestNotesSearchType.CONTEXT,
  );

  // get results
  const { data } = useInfiniteNoteSearch(searchType, debouncedSearchText, 200);

  // extracted notes, but only if data is not loading -> otherwise short flickering
  // when changed the search query with text, that nothing was found, since data is undefined for a short time
  const notes = useRef<MinimalNote[]>([]);
  if (data !== undefined) {
    notes.current = data?.pages.flat() ?? [];
  }

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
    if (notes.current.length === 0) {
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
        {notes.current.map((note: MinimalNote, index: number) => (
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
                color: theme.palette.primary.light,
              }}
            >
              {note.title}
            </Typography>

            <Stack direction="row" spacing={2} sx={{ mb: M2 }}>
              <Chip
                label={users[note.author_id]?.username || "unknown"}
                variant="outlined"
                size="small"
              ></Chip>

              <Chip
                label={formatDistanceToNowStrict(new Date(note.updated_at), {
                  addSuffix: true,
                })}
                variant="outlined"
                size="small"
              />

              <Chip
                label={getDirectoryPath(note.id)}
                variant="outlined"
                size="small"
              />
            </Stack>

            <Divider sx={{ my: M3 }} />
            {/* Highlight Box */}

            {highlightSearchMatch({
              content: note.stripped_content,
              query: searchQuery,
              searchType,
              contextChars: 100,
              theme,
            })}
          </Paper>
        ))}
      </Stack>
    );
  }, [isLoading, notes.current, searchType, theme]);

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
            backgroundColor: alpha(theme.palette.background.default, 0.85),
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
              maxHeight: "85%",
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
              {/* search strategy */}
              <Box width={"20%"}>
                <SearchStrategySelect
                  searchType={searchType}
                  setSearchType={setSearchType}
                  color="primary"
                />
              </Box>

              {/* search field */}
              <Box
                width={"60%"}
                sx={{
                  justifyContent: "center",
                  display: "flex",
                }}
              >
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
                    minWidth: "50%",
                    maxWidth: "100%",
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
              </Box>

              {/* result count and close button */}
              <Box
                sx={{
                  width: "20%",
                  justifyContent: "flex-end",
                  display: "flex",
                }}
              >
                <Button
                  size="large"
                  variant="outlined"
                  onClick={onClose}
                  color="inherit"
                  sx={{
                    px: 6,
                    gap: 1,
                    width: "20%",
                    borderRadius: theme.shape.borderRadius,
                    color: theme.palette.text.secondary,
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.text.primary, 0.1),
                    },
                  }}
                >
                  <CloseIcon fontSize="medium" />
                  <KeyboardShortcut shortcut="esc" />
                </Button>
              </Box>
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
