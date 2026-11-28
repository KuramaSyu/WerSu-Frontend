import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, Fab, Stack } from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { useNavigate } from "react-router-dom";
import {
  expandToSubtree,
  passesFilter,
  useSearchFilterStore,
} from "../../../zustand/useSearchFilterStore";
import { useAllDirectoriesQuery } from "../../../api/queries/directoryQueries";
import { RestNotesSearchType } from "../../../api/models/search";
import { useSearchNotesStore } from "../../../zustand/useSearchNotesStore";
import { useThemeStore } from "../../../zustand/useThemeStore";
import { NoteVisibilityScope } from "../../../api/models/noteVisibility";
import {
  isNoteHiddenForScope,
  ruleHiddenForScope,
  useNoteVisibilityStore,
} from "../../../zustand/useNoteVisibilityStore";
import { useSearchResults } from "./SearchResultsList.hook";
import SearchResultRow from "./SearchResultRow";
import SearchResultsEmptyState from "./SearchResultsEmptyState";
import InfiniteScrollSentinel from "./InfiniteScrollSentinel";
import type { SearchResult, SearchResultContext } from "./SearchResult";
import { NoteSearchResult } from "./NoteSearchResult";
import {
  DirectorySearchResult,
  searchDirectories,
} from "./DirectorySearchResult";

// render the selected row + a tail so arrow-key navigation is smooth
const RENDER_TAIL = 15;
// keep this many leading rows mounted even when far down the list
const STRIP_THRESHOLD = 100;
// strip whole chunks once we cross the threshold
const STRIP_CHUNK = 100;
// at most this many directory results in the combined list
const DIRECTORY_RESULT_LIMIT = 3;
// px scrolled before the "back to top" FAB appears: the user has to
// actually scroll a bit, it never shows up on open
const GO_TO_TOP_SHOW_PX = 240;
// hysteresis so the FAB doesn't flicker around the threshold
const GO_TO_TOP_HIDE_PX = 120;
// only worth offering when the list is long enough to be scrolled
const GO_TO_TOP_MIN_RESULTS = 10;

// scrollable list of results with arrow-key navigation
export const SearchResultsList: React.FC = () => {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const { byId: directoriesById } = useAllDirectoriesQuery();
  const setIsDialogOpen = useSearchNotesStore((s) => s.setIsDialogOpen);
  const isDialogOpen = useSearchNotesStore((s) => s.isDialogOpen);

  const {
    notes,
    isInitialLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useSearchResults();

  const filter = useSearchFilterStore((s) => s.filter);
  const debouncedSearch = useSearchFilterStore((s) => s.debouncedSearch);
  const searchType = useSearchFilterStore((s) => s.searchType);
  const setSearch = useSearchFilterStore((s) => s.setSearch);
  const visibilityNotes = useNoteVisibilityStore((state) => state.notes);
  const visibilityDirectories = useNoteVisibilityStore(
    (state) => state.directories,
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedWith, setSelectedWith] = useState<"mouse" | "keyboard">(
    "mouse",
  );
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // expand the directory selection to the full subtree when scope=subtree
  const effectiveDirs = useMemo(
    () => expandToSubtree(filter.selectedDirs, filter.scope, directoriesById),
    [filter.selectedDirs, filter.scope, directoriesById],
  );

  const filteredNotes = useMemo(
    () =>
      notes.filter(
        (note) =>
          passesFilter(note.directory_ids, filter, effectiveDirs) &&
          !isNoteHiddenForScope(
            visibilityNotes,
            visibilityDirectories,
            note.id,
            NoteVisibilityScope.SEARCH,
            note.directory_ids,
          ),
      ),
    [
      notes,
      filter,
      effectiveDirs,
      visibilityNotes,
      visibilityDirectories,
    ],
  );

  const closeOverlay = useCallback(() => {
    setIsDialogOpen(false);
  }, [setIsDialogOpen]);

  // Shared context handed to every result implementation.
  const resultContext = useMemo<SearchResultContext>(
    () => ({
      theme,
      searchQuery: debouncedSearch,
      searchType,
      directoriesById,
      navigate,
      closeOverlay,
    }),
    [
      theme,
      debouncedSearch,
      searchType,
      directoriesById,
      navigate,
      closeOverlay,
    ],
  );

  // Notes respect the directory filter / search strategy.
  const noteResults = useMemo<SearchResult[]>(
    () => filteredNotes.map((note) => new NoteSearchResult(note, resultContext)),
    [filteredNotes, resultContext],
  );

  // Directories ignore the note filter mode. They are fuzzy-matched, but in
  // exact/keyword mode only (partially) exact directory hits are kept; the
  // context (and fuzzy) strategies keep the fuzzy results too.
  const directoryMatches = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const matches = searchDirectories(
      debouncedSearch,
      directoriesById,
      DIRECTORY_RESULT_LIMIT,
    ).filter(
      (match) =>
        !ruleHiddenForScope(
          visibilityDirectories,
          match.directory.id,
          NoteVisibilityScope.SEARCH,
        ),
    );
    if (searchType === RestNotesSearchType.KEYWORD) {
      return matches.filter((match) => match.exact);
    }
    return matches;
  }, [
    debouncedSearch,
    directoriesById,
    searchType,
    visibilityDirectories,
  ]);

  // Only literal / partial-exact directory hits may lead the list. Purely
  // fuzzy directory matches fall below the note results instead.
  const exactDirectoryResults = useMemo<SearchResult[]>(
    () =>
      directoryMatches
        .filter((match) => match.exact)
        .map(
          ({ directory }) =>
            new DirectorySearchResult(directory, resultContext),
        ),
    [directoryMatches, resultContext],
  );

  const fuzzyDirectoryResults = useMemo<SearchResult[]>(
    () =>
      directoryMatches
        .filter((match) => !match.exact)
        .map(
          ({ directory }) =>
            new DirectorySearchResult(directory, resultContext),
        ),
    [directoryMatches, resultContext],
  );

  const results = useMemo<SearchResult[]>(
    () => [
      ...exactDirectoryResults,
      ...noteResults,
      ...fuzzyDirectoryResults,
    ],
    [exactDirectoryResults, noteResults, fuzzyDirectoryResults],
  );

  // bounded window: keep the selected row + a tail mounted, strip chunks
  // from the front once selection crosses the threshold
  const visibleResults = useMemo(() => {
    const end = Math.min(results.length, selectedIndex + 1 + RENDER_TAIL);
    const start =
      end <= STRIP_THRESHOLD
        ? 0
        : Math.floor((selectedIndex - STRIP_THRESHOLD) / STRIP_CHUNK) *
            STRIP_CHUNK +
          STRIP_THRESHOLD;
    return results.slice(start, end);
  }, [results, selectedIndex]);

  const visibleStartIndex =
    visibleResults.length > 0 ? results.indexOf(visibleResults[0]) : 0;

  // stable callbacks so memoized rows can skip re-rendering
  const handleSelect = useCallback((index: number) => {
    setSelectedWith("mouse");
    setSelectedIndex(index);
  }, []);

  const handleActivate = useCallback((result: SearchResult) => {
    result.on_click();
  }, []);

  const handleLoadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  // scroll the selected row into view when navigating by keyboard
  useEffect(() => {
    if (selectedWith !== "keyboard") return;
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-search-index="${selectedIndex}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedIndex, selectedWith]);

  // Arrow keys move selection, Enter activates the result + clears the
  // query. Document-scoped, so it must only listen while the overlay is
  // actually open: on mobile the search drawer stays mounted after its
  // first open, and an ungated handler would hijack Enter typed in the
  // note editor and navigate to the previously selected result.
  useEffect(() => {
    if (!isDialogOpen) return;
    /** set selection to keybaord and disable hover if user used keyboard */
    const upOrDown = () => {
      setSelectedWith("keyboard");
      setHoverEnabled(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        upOrDown();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        upOrDown();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        const selected = results[selectedIndex];
        if (selected) handleActivate(selected);
        setSearch("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen, results, selectedIndex, setSearch, handleActivate]);

  // re-enable hover once the user actually moves the mouse
  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const distance = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      if (distance > 20) setHoverEnabled(true);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // reset selection to top whenever the query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedSearch, searchType]);

  // reveal the "back to top" FAB only once the user scrolled past the
  // show threshold, and keep it until they come back near the top.
  const goToTopVisible =
    showGoToTop && results.length > GO_TO_TOP_MIN_RESULTS;
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const handleScroll = () => {
      const y = root.scrollTop;
      setShowGoToTop((prev) =>
        prev ? y > GO_TO_TOP_HIDE_PX : y > GO_TO_TOP_SHOW_PX,
      );
    };
    handleScroll();
    root.addEventListener("scroll", handleScroll, { passive: true });
    return () => root.removeEventListener("scroll", handleScroll);
  }, []);

  const handleGoToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <Box
      sx={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        ref={scrollRef}
        sx={{
          zIndex: 1301,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          position: "relative",
          overflowX: "hidden",
          // scrollbar stays hidden; the "back to top" FAB is the
          // scroll affordance instead
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        <Box sx={{ width: "98%" }}>
          <Stack spacing={1.5}>
            {visibleResults.map((result, offset) => {
              const index = visibleStartIndex + offset;
              return (
                <SearchResultRow
                  key={result.get_id()}
                  result={result}
                  index={index}
                  isSelected={index === selectedIndex}
                  hoverEnabled={hoverEnabled}
                  onSelect={handleSelect}
                  onActivate={handleActivate}
                />
              );
            })}
          </Stack>

          <SearchResultsEmptyState
            isInitialLoading={isInitialLoading}
            hasResults={results.length > 0}
            searchQuery={debouncedSearch}
          />

          <InfiniteScrollSentinel
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={handleLoadMore}
          />
        </Box>
      </Box>

      {/* Back-to-top FAB: fades in after a real scroll, stays hidden
          for short lists and right after opening. */}
      <Fab
        size="small"
        color="primary"
        aria-label="Scroll back to top"
        aria-hidden={!goToTopVisible}
        tabIndex={goToTopVisible ? 0 : -1}
        // keep focus in the search input when the FAB is clicked
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleGoToTop}
        sx={{
          position: "absolute",
          right: 12,
          bottom: 12,
          zIndex: 1302,
          visibility: goToTopVisible ? "visible" : "hidden",
          opacity: goToTopVisible ? 1 : 0,
          transform: goToTopVisible ? "none" : "translateY(8px)",
          transition: theme.transitions.create(
            ["opacity", "transform", "visibility"],
            {
              duration: theme.transitions.duration.short,
              easing: theme.transitions.easing.easeInOut,
            },
          ),
        }}
      >
        <KeyboardArrowUpIcon />
      </Fab>
    </Box>
  );
};

export default SearchResultsList;
