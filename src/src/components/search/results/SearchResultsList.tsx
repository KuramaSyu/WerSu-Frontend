import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  expandToSubtree,
  passesFilter,
  useSearchFilterStore,
} from "../../../zustand/useSearchFilterStore";
import { useDirectoryStore } from "../../../zustand/useDirectoryStore";
import { useSearchNotesStore } from "../../../zustand/useSearchNotesStore";
import { M3 } from "../../../statics";
import { useSearchResults } from "./SearchResultsList.hook";
import SearchResultRow from "./SearchResultRow";
import SearchResultsEmptyState from "./SearchResultsEmptyState";
import InfiniteScrollSentinel from "./InfiniteScrollSentinel";

// render the selected row + a tail so arrow-key navigation is smooth
const RENDER_TAIL = 15;
// keep this many leading rows mounted even when far down the list
const STRIP_THRESHOLD = 100;
// strip whole chunks once we cross the threshold
const STRIP_CHUNK = 100;

// scrollable list of results with arrow-key navigation
export const SearchResultsList: React.FC = () => {
  const navigate = useNavigate();
  const directoriesById = useDirectoryStore((s) => s.directoriesById);
  const setIsDialogOpen = useSearchNotesStore((s) => s.setIsDialogOpen);

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

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedWith, setSelectedWith] = useState<"mouse" | "keyboard">(
    "mouse",
  );
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // expand the directory selection to the full subtree when scope=subtree
  const effectiveDirs = useMemo(
    () => expandToSubtree(filter.selectedDirs, filter.scope, directoriesById),
    [filter.selectedDirs, filter.scope, directoriesById],
  );

  const filteredNotes = useMemo(
    () =>
      notes.filter((note) =>
        passesFilter(note.directory_ids, filter, effectiveDirs),
      ),
    [notes, filter, effectiveDirs],
  );

  // bounded window: keep the selected row + a tail mounted, strip chunks
  // from the front once selection crosses the threshold
  const visibleNotes = useMemo(() => {
    const end = Math.min(filteredNotes.length, selectedIndex + 1 + RENDER_TAIL);
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

  // stable callbacks so memoized rows can skip re-rendering
  const handleSelect = useCallback((index: number) => {
    setSelectedWith("mouse");
    setSelectedIndex(index);
  }, []);

  const handleNavigate = useCallback(
    (noteId: string) => {
      navigate(`/n/${noteId}`);
      setIsDialogOpen(false);
    },
    [navigate, setIsDialogOpen],
  );

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

  // arrow keys move selection, Enter opens the note + clears the query
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
        const selected = filteredNotes[selectedIndex];
        if (selected) handleNavigate(selected.id);
        setSearch("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredNotes, selectedIndex, setSearch, handleNavigate]);

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

  return (
    <Box
      ref={scrollRef}
      sx={{
        zIndex: 1301,
        flex: 1,
        overflowY: "auto",
        scrollbarGutter: "stable",
        position: "relative",
      }}
    >
      <Box sx={{ width: "98%" }}>
        <Stack spacing={M3}>
          {visibleNotes.map((note, offset) => {
            const index = visibleStartIndex + offset;
            return (
              <SearchResultRow
                key={note.id}
                note={note}
                index={index}
                isSelected={index === selectedIndex}
                hoverEnabled={hoverEnabled}
                searchQuery={debouncedSearch}
                searchType={searchType}
                onSelect={handleSelect}
                onNavigate={handleNavigate}
              />
            );
          })}
        </Stack>

        <SearchResultsEmptyState
          isInitialLoading={isInitialLoading}
          hasResults={filteredNotes.length > 0}
          searchQuery={debouncedSearch}
        />

        <InfiniteScrollSentinel
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={handleLoadMore}
        />
      </Box>
    </Box>
  );
};

export default SearchResultsList;
