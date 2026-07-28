import React, { createContext, useContext, useMemo, useRef } from "react";
import { useSearchFilterStore } from "../../../zustand/useSearchFilterStore";
import { useInfiniteNoteSearch } from "../../../api/queries/useNoteQueries";
import { Note, type MinimalNote } from "../../../api/models/search";

// One subscription to TanStack so two consumers (shell + list) don't
// each re-render on every internal state tick. We flatten pages inside
// a useMemo keyed on the page count + last note id so the resulting
// array only changes when a new page actually arrives — not on every
// TanStack status transition (status flip, fetchStatus flip, etc.).

interface SearchResultsSnapshot {
  notes: Note[];
  isInitialLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

const EMPTY_NOTES: Note[] = [];

const EMPTY_SNAPSHOT: SearchResultsSnapshot = {
  notes: EMPTY_NOTES,
  isInitialLoading: true,
  isFetchingNextPage: false,
  hasNextPage: false,
  fetchNextPage: () => undefined,
};

const SearchResultsContext =
  createContext<SearchResultsSnapshot>(EMPTY_SNAPSHOT);

const flattenPages = (
  pages: { notes: MinimalNote[] }[] | undefined,
): MinimalNote[] => {
  if (!pages || pages.length === 0) return EMPTY_NOTES;
  const out: MinimalNote[] = [];
  for (const page of pages) {
    for (const n of page.notes) out.push(n);
  }
  return out;
};

// Provider: single useInfiniteNoteSearch call drives the whole overlay.
export const SearchResultsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const filter = useSearchFilterStore((s) => s.filter);
  const searchType = useSearchFilterStore((s) => s.searchType);
  const debouncedSearch = useSearchFilterStore((s) => s.debouncedSearch);

  // include + no dirs would match nothing, so skip the round-trip
  const searchEnabled = !(
    filter.mode === "include" && filter.selectedDirs.length === 0
  );

  const query = useInfiniteNoteSearch(
    searchType,
    debouncedSearch,
    30,
    searchEnabled,
  );

  // Flatten pages on real page arrivals only. TanStack mutates
  // `query.data.pages` in place when it appends a new page, so we key
  // the memo on the array length + the last page's last note id —
  // identity-stable across every other internal state tick.
  const pages = query.data?.pages;
  const pageCount = pages?.length ?? 0;
  const lastPageNotes = pages?.[pageCount - 1]?.notes;
  const lastNoteId =
    lastPageNotes && lastPageNotes.length > 0
      ? lastPageNotes[lastPageNotes.length - 1].id
      : null;

  // hold the previous flatten so a fresh query (whose `query.data` is
  // briefly `undefined` between debouncedSearch flipping and the first
  // page landing) doesn't wipe the visible list to empty
  const flatNotesRef = useRef<MinimalNote[]>(EMPTY_NOTES);
  const flatNotes = useMemo(() => flattenPages(pages), [pageCount, lastNoteId]);
  if (flatNotes.length > 0 || pageCount > 0) {
    flatNotesRef.current = flatNotes;
  }

  // Build Note instances once per flatNotes identity so memoised rows
  // see a new `note` prop only when the underlying list actually grows.
  const notesRef = useRef<Note[]>(EMPTY_NOTES);
  notesRef.current = useMemo(
    () => flatNotesRef.current.map((n) => new Note({ content: "", ...n })),
    [flatNotesRef.current],
  );

  // keep fetchNextPage referentially stable so `useCallback` callers
  // in the list don't invalidate
  const fetchNextPageRef = useRef(query.fetchNextPage);
  fetchNextPageRef.current = query.fetchNextPage;

  const value = useMemo<SearchResultsSnapshot>(
    () => ({
      notes: notesRef.current,
      isInitialLoading: query.isLoading || query.isPending,
      isFetchingNextPage: query.isFetchingNextPage,
      hasNextPage: !!query.hasNextPage,
      fetchNextPage: () => {
        void fetchNextPageRef.current();
      },
    }),
    [
      notesRef.current,
      query.isLoading,
      query.isPending,
      query.isFetchingNextPage,
      query.hasNextPage,
    ],
  );

  return (
    <SearchResultsContext.Provider value={value}>
      {children}
    </SearchResultsContext.Provider>
  );
};

export const useSearchResults = (): SearchResultsSnapshot =>
  useContext(SearchResultsContext);
