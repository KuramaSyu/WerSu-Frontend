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
  /** True when the current filter was applied automatically (e.g. scoped to the open directory). */
  isAutoApplied: boolean;
  /** Filter to restore when clearing an auto-applied filter. */
  filterBeforeAuto: SearchFilter | null;

  // setters
  setSearchType: (t: RestNotesSearchType) => void;
  setSearch: (q: string) => void;
  setDebouncedSearch: (q: string) => void;
  setFilterMode: (m: SearchFilterMode) => void;
  setSelectedDirs: (ids: string[]) => void;
  setFilterScope: (s: SearchFilterScope) => void;
  setFilter: (filter: Partial<SearchFilter>) => void;
  /** Apply an automatic filter, remembering the previous one for `clearFilter`. */
  applyAutoFilter: (filter: Partial<SearchFilter>) => void;
  /** Clear the filter; when auto-applied, only the automatic change is reverted. */
  clearFilter: () => void;
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
    isAutoApplied: false,
    filterBeforeAuto: null,

    setSearchType: (t) => set({ searchType: t }),
    setSearch: (q) => set({ search: q }),
    setDebouncedSearch: (q) => set({ debouncedSearch: q }),
    // Any user edit supersedes an auto-applied filter, so dropping the
    // restore point makes the clear button fall back to "clear all".
    setFilterMode: (m) =>
      set((state) => ({
        filter: { ...state.filter, mode: m },
        isAutoApplied: false,
        filterBeforeAuto: null,
      })),
    setSelectedDirs: (ids) =>
      set((state) => ({
        filter: { ...state.filter, selectedDirs: ids },
        isAutoApplied: false,
        filterBeforeAuto: null,
      })),
    setFilterScope: (s) =>
      set((state) => ({
        filter: { ...state.filter, scope: s },
        isAutoApplied: false,
        filterBeforeAuto: null,
      })),
    setFilter: (partial) =>
      set((state) => ({
        filter: { ...state.filter, ...partial },
        isAutoApplied: false,
        filterBeforeAuto: null,
      })),
    applyAutoFilter: (partial) =>
      set((state) => ({
        filter: { ...state.filter, ...partial },
        // Keep the original restore point if auto-apply runs again.
        filterBeforeAuto: state.isAutoApplied
          ? state.filterBeforeAuto
          : state.filter,
        isAutoApplied: true,
      })),
    clearFilter: () =>
      set((state) => {
        if (state.isAutoApplied && state.filterBeforeAuto) {
          return {
            filter: state.filterBeforeAuto,
            isAutoApplied: false,
            filterBeforeAuto: null,
          };
        }
        return {
          filter: defaultFilter(),
          isAutoApplied: false,
          filterBeforeAuto: null,
        };
      }),
    resetFilter: () =>
      set({
        filter: defaultFilter(),
        isAutoApplied: false,
        filterBeforeAuto: null,
      }),
    resetAll: () =>
      set({
        search: "",
        debouncedSearch: "",
        filter: defaultFilter(),
        isAutoApplied: false,
        filterBeforeAuto: null,
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
