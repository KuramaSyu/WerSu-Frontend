import { create } from "zustand";
import { RestNotesSearchType } from "../api/models/search";
import {
  FALLBACK_SEARCH_TYPE,
  SEARCH_TYPE_NO_OVERRIDE,
  useSearchSettings,
} from "./useSearchSettings";

/** Directory filter mode: all = no filter; include/exclude intersect against note directories. */
export type SearchFilterMode = "all" | "include" | "exclude";

/** Scope of directory selection: direct = selected ids only; subtree = descendants too. */
export type SearchFilterScope = "direct" | "subtree";

export interface SearchFilter {
  /** Selected directory ids plus the synthetic "root" sentinel. */
  selectedDirs: string[];
  /** How the selected dirs are applied. */
  mode: SearchFilterMode;
  /** Whether the selection expands to all transitive descendants. */
  scope: SearchFilterScope;
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
  setFilterScope: (s: SearchFilterScope) => void;
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
  scope: "direct",
});

export const useSearchFilterStore = create<SearchFilterState>((set) => {
  // Seeded from the persisted search-settings store so the
  // user-chosen default is in place on the very first render.
  const settingsDefault = useSearchSettings.getState().defaultSearchType;
  const initialSearchType =
    settingsDefault === SEARCH_TYPE_NO_OVERRIDE
      ? FALLBACK_SEARCH_TYPE
      : settingsDefault;
  return {
    searchType: initialSearchType,
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
    setFilterScope: (s) =>
      set((state) => ({ filter: { ...state.filter, scope: s } })),
    setFilter: (partial) =>
      set((state) => ({ filter: { ...state.filter, ...partial } })),
    resetFilter: () => set({ filter: defaultFilter() }),
    resetAll: () =>
      set({
        search: "",
        debouncedSearch: "",
        filter: defaultFilter(),
      }),
  };
});

/** True when the note's directories pass the filter; effectiveDirs is already expanded by caller. */
export function passesFilter(
  directoryIds: string[],
  filter: SearchFilter,
  effectiveDirs: string[],
): boolean {
  if (filter.mode === "all") return true;
  if (effectiveDirs.length === 0) {
    return filter.mode === "exclude";
  }
  const noteDirs = directoryIds.length > 0 ? directoryIds : [ROOT_SENTINEL_ID];
  const intersects = noteDirs.some((d) => effectiveDirs.includes(d));
  return filter.mode === "include" ? intersects : !intersects;
}

/** Expand selectedDirs to transitive descendants; root sentinel maps to every top-level dir. */
export function expandToSubtree(
  selectedDirs: string[],
  scope: SearchFilterScope,
  directoriesById: Record<
    string,
    { id?: string; child_dir_ids?: string[]; parent_dir_ids?: string[] }
  >,
): string[] {
  if (selectedDirs.length === 0) {
    return selectedDirs;
  }

  // Expand the synthetic root sentinel to every top-level directory;
  // passesFilter treats orphan notes as living under root too.
  const seedIds = selectedDirs.includes(ROOT_SENTINEL_ID)
    ? [
        ...new Set([
          ...selectedDirs.filter((id) => id !== ROOT_SENTINEL_ID),
          ...Object.values(directoriesById)
            .filter(
              (d) =>
                d.parent_dir_ids === undefined || d.parent_dir_ids.length === 0,
            )
            .map((d) => d.id)
            .filter((id): id is string => typeof id === "string"),
        ]),
      ]
    : selectedDirs;

  if (scope !== "subtree") {
    return seedIds;
  }

  const out = new Set<string>(seedIds);
  const queue: string[] = [...seedIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    const dir = directoriesById[id];
    if (!dir?.child_dir_ids) continue;
    for (const child of dir.child_dir_ids) {
      if (!out.has(child)) {
        out.add(child);
        queue.push(child);
      }
    }
  }
  return Array.from(out);
}
