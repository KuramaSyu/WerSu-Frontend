import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Paper,
  CircularProgress,
  Chip,
  alpha,
  Portal,
  Divider,
  Fade,
  Grow,
  TextField,
  InputAdornment,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useThemeStore } from "../../zustand/useThemeStore";
import { useSearchNotesStore } from "../../zustand/useSearchNotesStore";
import {
  useSearchFilterStore,
  passesFilter,
  SEARCH_DEBOUNCE_DELAY_MS,
  type SearchFilter,
} from "../../zustand/useSearchFilterStore";
import {
  RestNotesSearchType,
  type MinimalNote,
  Note,
} from "../../api/models/search";
import { M2, M3, M4 } from "../../statics";
import { useInfiniteNoteSearch } from "../../api/queries/useNoteQueries";
import SearchStrategySelect from "../SearchStrategySelect";
import SearchFilterComponent from "./SearchFilter";
import SearchIcon from "@mui/icons-material/Search";
import { highlightSearchMatch } from "./SearchResultHighlights";
import { KeyboardShortcut } from "../../utils/renderShortcut";
import { useUsersStore } from "../../zustand/userStore";
import { formatDistanceToNowStrict } from "date-fns";
import { colorFromString } from "../../utils/blendWithContrast";
import { LogoSvgComponent } from "../../pages/LoadingPage/Main";
import { animated, useTrail } from "@react-spring/web";
import { useNavigate } from "react-router-dom";

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
 * All search state (raw + debounced query, search type, directory filter)
 * lives in `useSearchFilterStore` so the search bar, the filter component,
 * and the result list stay in sync without prop-drilling.
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
  const {
    search,
    debouncedSearch,
    searchType,
    filter,
    setSearch,
    setDebouncedSearch,
    setSearchType,
    resetAll,
  } = useSearchFilterStore();

  // results
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteNoteSearch(searchType, debouncedSearch, 30);

  // extracted notes, but only if data is not loading -> otherwise short flickering
  // when changed the search query with text, that nothing was found, since data is undefined for a short time
  const notes = useRef<Note[]>([]);
  if (data !== undefined) {
    notes.current =
      data?.map((note) => new Note({ content: "", ...note })) ?? [];
  }

  // debounce raw search input into the debounced value used by the query
  useEffect(() => {
    if (search === "") {
      setDebouncedSearch(search);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [search, setDebouncedSearch]);

  // keybinds of overlay itself: ESC = close & clear search, Enter = clear search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        resetAll();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, resetAll]);

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
            backgroundColor: alpha(
              theme.blendAgainstContrast(
                theme.palette.background.default,
                0.5,
                undefined,
              ),
              0.8,
            ),
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
              backgroundColor: theme.palette.background.default,
              borderRadius: M3,
              boxShadow: theme.shadows[8],
              zIndex: 1300,
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              display: "flex",
              flexDirection: "column",
              gap: M3,
              p: M3,
            }}
          >
            {/* Header with close button */}
            <Stack
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
              }}
              direction="row"
            >
              {/* search strategy */}
              <Box sx={{ width: "20%" }}>
                <SearchStrategySelect
                  searchType={searchType}
                  setSearchType={setSearchType}
                  color="primary"
                />
              </Box>

              {/* search field */}
              <Box
                sx={{
                  width: "60%",
                  justifyContent: "center",
                  display: "flex",
                }}
              >
                <TextField
                  autoFocus
                  placeholder="Search"
                  variant="outlined"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
                  color="primary"
                  sx={{
                    px: 4,
                    gap: 1,
                    width: "20%",
                    borderRadius: theme.shape.borderRadius,
                  }}
                >
                  <CloseIcon fontSize="medium" />
                  <KeyboardShortcut shortcut="esc" onlyText={true} />
                </Button>
              </Box>
            </Stack>

            {/* directory + mode filter */}
            <SearchFilterComponent />

            <Box
              sx={{
                zIndex: 1301,
                flex: 1,
                overflowY: "auto",
                scrollbarGutter: "stable",
                position: "relative",
              }}
            >
              {/* scrollbar padding */}
              <Box sx={{ width: "98%" }}>
                {/* Results or Loading */}
                <ResultContent
                  searchQuery={debouncedSearch}
                  searchType={searchType}
                  theme={theme}
                  users={users}
                  rawNotes={notes.current}
                  filter={filter}
                  setSeacrhQuery={setSearch}
                />
                {/* Load next page when the sentinel scrolls into view */}
                <InfiniteScrollSentinel
                  hasNextPage={!!hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  onLoadMore={() => void fetchNextPage()}
                />
              </Box>
            </Box>
          </Box>
        </Grow>
      </Portal>
    </>
  );
};

export default SearchResultsOverlay;

export const TextTrail = ({ children }: { children: React.ReactNode }) => {
  const items = React.Children.toArray(children);
  const trail = useTrail(items.length, {
    from: {
      opacity: 0,
      transform: "translate3d(0,16px,0)",
    },
    to: {
      opacity: 1,
      transform: "translate3d(0,0px,0)",
    },
  });

  return (
    <>
      {trail.map((style, index) => (
        <animated.div key={index} style={style}>
          {items[index]}
        </animated.div>
      ))}
    </>
  );
};

interface ResultContentProps {
  searchQuery: string;
  searchType: RestNotesSearchType;
  theme: ReturnType<typeof useThemeStore.getState>["theme"];
  users: ReturnType<typeof useUsersStore.getState>["users"];
  rawNotes: Note[];
  filter: SearchFilter;
  setSeacrhQuery: (query: string) => void;
}

/**
 * How many trailing rows we keep mounted around the selection so
 * arrow-key navigation feels smooth.
 */
const RENDER_TAIL = 15;

/**
 * Once `selectedIndex` exceeds this, we start stripping rows from the
 * beginning of the filtered list in chunks of this size. That keeps
 * the rendered DOM bounded even when the filtered list is huge,
 * without yanking rows out from under the user as they scroll.
 */
const STRIP_THRESHOLD = 100;
const STRIP_CHUNK = 100;

const ResultContent = ({
  searchQuery,
  searchType,
  theme,
  users,
  rawNotes,
  filter,
  setSeacrhQuery,
}: ResultContentProps) => {
  const navigate = useNavigate();
  const { setIsDialogOpen } = useSearchNotesStore();
  // to scroll when navigating with keyboard
  const selectedRef = useRef<HTMLDivElement>(null);

  // index for current selected note (into the *filtered* list)
  const [selectedIndex, setSelectedIndex] = useState(0);

  // to disable navigation when mouse is used
  const [selectedWith, setSelectedWith] = useState<"mouse" | "keyboard">(
    "mouse",
  );

  const [hoverEnabled, setHoverEnabled] = useState(true);

  /**
   * Filter the raw notes against the directory filter. Cheap O(n)
   * boolean check, no React trees created — runs on every render but
   * is far cheaper than mounting 500 `<Paper>` elements.
   */
  const filteredNotes = useMemo(
    () => rawNotes.filter((note) => passesFilter(note.directory_ids, filter)),
    [rawNotes, filter],
  );

  /**
   * Slice of `filteredNotes` we actually mount.
   *
   * Always renders `0 .. selectedIndex + RENDER_TAIL` so the selected
   * row and its trailing neighbours stay mounted (smooth arrow-key
   * navigation). To keep the rendered DOM bounded once
   * `selectedIndex > STRIP_THRESHOLD`, we strip whole `STRIP_CHUNK`
   * blocks from the beginning — so when the user is on row 115 we
   * render rows 100..130, on row 216 we render 200..231, and so on.
   * The first `STRIP_THRESHOLD` rows are never stripped, so a normal
   * search session never sees the cut.
   */
  const visibleNotes = useMemo(() => {
    const end = Math.min(
      filteredNotes.length,
      selectedIndex + 1 + RENDER_TAIL,
    );
    const start =
      end <= STRIP_THRESHOLD
        ? 0
        : Math.floor((selectedIndex - STRIP_THRESHOLD) / STRIP_CHUNK) *
            STRIP_CHUNK +
          STRIP_THRESHOLD;
    return filteredNotes.slice(start, end);
  }, [filteredNotes, selectedIndex]);

  const visibleStartIndex =
    visibleNotes.length > 0 ? filteredNotes.indexOf(visibleNotes[0]) : 0;

  // UX: when navigating out of dialog with keyboard, scroll to selected note
  useEffect(() => {
    if (selectedWith !== "keyboard") return;
    selectedRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [selectedIndex, selectedWith]);

  // UX: keybindings for navigating results
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        setSelectedWith("keyboard");
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredNotes.length - 1),
        );
        setHoverEnabled(false);
      } else if (e.key === "ArrowUp") {
        setSelectedWith("keyboard");
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        setHoverEnabled(false);
      } else if (e.key === "Enter") {
        selectedRef.current?.click();
        setSeacrhQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredNotes.length, setSeacrhQuery]);

  // UX: disable mouse when user types, to prevent accidental mouse hovers
  useEffect(() => {
    let lastX = 0;
    let lastY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      // vector distance -> ||mouse movement|| > 20 => re-enable hover
      const distance = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      if (distance > 20) {
        setHoverEnabled(true);
      }

      lastX = e.clientX;
      lastY = e.clientY;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [setHoverEnabled]);

  // UX: set index back to 0 when search query or type changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, searchType]);

  return (
    <>
      <Stack spacing={M3}>
        {visibleNotes.map((note: Note, offset) => {
          const index = visibleStartIndex + offset;
          const isSelected = index === selectedIndex;
          return (
            <Paper
              ref={isSelected ? selectedRef : null}
              elevation={isSelected ? 5 : 1}
              onMouseEnter={() => {
                if (hoverEnabled) {
                  setSelectedWith("mouse");
                  setSelectedIndex(index);
                }
              }}
              onClick={() => {
                navigate(`/n/${note.id}`);
                setIsDialogOpen(false);
              }}
              key={`${note.id}-${index}`}
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

                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ mb: M2, minWidth: 5 / 8 }}
                >
                  <Chip
                    label={users[note.author_id]?.username || "unknown"}
                    variant="outlined"
                    size="small"
                  ></Chip>

                  <Chip
                    label={formatDistanceToNowStrict(
                      new Date(note.updated_at),
                      {
                        addSuffix: true,
                      },
                    )}
                    variant="outlined"
                    size="small"
                  />
                </Stack>
              </Box>

              <Divider orientation="vertical" flexItem />
              {/* Highlight Box */}

              {highlightSearchMatch({
                content: note.stripped_content,
                query: searchQuery,
                searchType,
                contextChars: 100,
                theme,
              })}
            </Paper>
          );
        })}
      </Stack>
      <Fade
        in={filteredNotes.length === 0}
        timeout={{ enter: theme.transitions.duration.short, exit: 0 }}
        unmountOnExit
      >
        <Stack direction={"row"} sx={{ alignItems: "center" }}>
          <Stack
            direction={"column"}
            sx={{
              width: 3 / 8,
              px: M4,
              gap: M3,
              justifyItems: "center",
              alignItems: "center",
            }}
          >
            <TextTrail key={searchQuery ? "search" : "no-search"}>
              <Typography variant="h4" color="textPrimary">
                I took a deep dive,
              </Typography>
              <Typography variant="h5" color="textSecondary">
                but hell, there is no
              </Typography>
              <Typography
                key={searchQuery || "empty"}
                color="primary"
                variant={searchQuery ? "h3" : "h6"}
                sx={{
                  py: M3,
                }}
              >
                {searchQuery || "Oh, you haven't even searched yet - nvm"}
              </Typography>
              {searchQuery && (
                <Typography variant="h5" color="textSecondary">
                  in the abyss of your notes.
                </Typography>
              )}
            </TextTrail>
          </Stack>
          <Box sx={{ display: "flex", width: 5 / 8, justifyContent: "center" }}>
            <Box
              sx={{ display: "flex", width: 5 / 8, justifyContent: "center" }}
            >
              <LogoSvgComponent />
            </Box>
          </Box>
        </Stack>
      </Fade>
    </>
  );
};

interface InfiniteScrollSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

// Triggers onLoadMore once when scrolled into view; minimal styling.
const InfiniteScrollSentinel: React.FC<InfiniteScrollSentinelProps> = ({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    // Walk up to the scroll container; the immediate parent isn't scrollable.
    let scrollRoot: Element | null = node.parentElement;
    while (scrollRoot && getComputedStyle(scrollRoot).overflowY !== "auto") {
      scrollRoot = scrollRoot.parentElement;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // Disconnect immediately so repeated intersection frames don't refire.
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          onLoadMore();
        }
      },
      { root: scrollRoot, rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (!hasNextPage && !isFetchingNextPage) return null;
  return (
    <Box ref={ref} sx={{ display: "flex", justifyContent: "center", py: M3 }}>
      {isFetchingNextPage && <CircularProgress size={20} />}
    </Box>
  );
};
