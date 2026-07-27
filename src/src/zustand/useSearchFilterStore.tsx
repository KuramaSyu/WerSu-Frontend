import { create } from "zustand";
import { RestNotesSearchType } from "../api/models/search";

/**
 * How the directory filter is applied to note results.
 *
 * `all` is the default and disables filtering: every note passes
 * through regardless of which directories are selected.
 *
 * `include` keeps only notes whose `directory_ids` intersect the
 * selected set.
 *
 * `exclude` drops notes whose `directory_ids` intersect the selected
 * set.
 */
export type SearchFilterMode = "all" | "include" | "exclude";

export interface SearchFilter {
  /** Selected directory ids plus the synthetic "root" sentinel. */
  selectedDirs: string[];
  /** How the selected dirs are applied. */
  mode: SearchFilterMode;
}

interface SearchFilterState {
  // search
  searchType: RestNotesSearchType;
  search: string;
  debouncedSearch: string;
  // filter
  filter: SearchFilter;

  // setters
  setSearchType: (t: RestNotesSearchType) => void;
  setSearch: (q: string) => void;
  setDebouncedSearch: (q: string) => void;
  setFilterMode: (m: SearchFilterMode) => void;
  setSelectedDirs: (ids: string[]) => void;
  setFilter: (filter: Partial<SearchFilter>) => void;
  resetFilter: () => void;
  resetAll: () => void;
}

const ROOT_DIR_ID = "root";

export const SEARCH_DEBOUNCE_DELAY_MS = 125;

export const ROOT_SENTINEL_ID = ROOT_DIR_ID;

const defaultFilter = (): SearchFilter => ({
  selectedDirs: [],
  mode: "all",
});

export const useSearchFilterStore = create<SearchFilterState>((set) => ({
  searchType: RestNotesSearchType.CONTEXT,
  search: "",
  debouncedSearch: "",
  filter: defaultFilter(),

  setSearchType: (t) => set({ searchType: t }),
  setSearch: (q) => set({ search: q }),
  setDebouncedSearch: (q) => set({ debouncedSearch: q }),
  setFilterMode: (m) =>
    set((state) => ({ filter: { ...state.filter, mode: m } })),
  setSelectedDirs: (ids) =>
    set((state) => ({ filter: { ...state.filter, selectedDirs: ids } })),
  setFilter: (partial) =>
    set((state) => ({ filter: { ...state.filter, ...partial } })),
  resetFilter: () => set({ filter: defaultFilter() }),
  resetAll: () =>
    set({
      search: "",
      debouncedSearch: "",
      filter: defaultFilter(),
    }),
}));

/**
 * Returns true when the given note's parent directories pass the
 * configured filter.
 *
 * - `mode: "all"` always returns true.
 * - `mode: "include"` keeps notes whose `directory_ids` intersect the
 *   selected set; notes with no parent directories are treated as
 *   living under the synthetic "root" sentinel.
 * - `mode: "exclude"` drops notes whose `directory_ids` intersect the
 *   selected set; an empty selection is a no-op (nothing to exclude).
 */
export function passesFilter(
  directoryIds: string[],
  filter: SearchFilter,
): boolean {
  if (filter.mode === "all") return true;
  const noteDirs = directoryIds.length > 0 ? directoryIds : [ROOT_SENTINEL_ID];
  const intersects =
    filter.selectedDirs.length === 0 ||
    noteDirs.some((d) => filter.selectedDirs.includes(d));
  return filter.mode === "include" ? intersects : !intersects;
}
