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

/**
 * How the directory selection expands before the include/exclude check.
 *
 * `direct` keeps only the user-selected directory ids. `subtree`
 * expands them to include every transitive descendant directory
 * (children, grandchildren, ...). The "root" sentinel stays a single
 * id — it has no descendants either way.
 */
export type SearchFilterScope = "direct" | "subtree";

export interface SearchFilter {
  /** Selected directory ids plus the synthetic "root" sentinel. */
  selectedDirs: string[];
  /** How the selected dirs are applied. */
  mode: SearchFilterMode;
  /**
   * Whether the selection expands to all transitive descendants.
   * Only takes effect when `mode !== "all"` and at least one
   * directory is selected.
   */
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
}));

/**
 * Returns true when the given note's parent directories pass the
 * configured filter.
 *
 * `effectiveDirs` is the *expanded* set of directory ids to compare
 * against — the raw `selectedDirs` for `scope: "direct"`, or the
 * full transitive subtree for `scope: "subtree"`. Expansion lives in
 * the caller (see `expandToSubtree`) so this function stays O(1) per
 * note.
 *
 * - `mode: "all"` always returns true.
 * - `mode: "include"` keeps only notes whose `directory_ids` intersect
 *   `effectiveDirs`; an empty `effectiveDirs` shows nothing. Notes
 *   with no parent directories are treated as living under the
 *   synthetic "root" sentinel.
 * - `mode: "exclude"` drops notes whose `directory_ids` intersect
 *   `effectiveDirs`; an empty `effectiveDirs` shows everything.
 */
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

/**
 * Expands `selectedDirs` to include every transitive descendant
 * directory id. Returns the input as-is when `scope === "direct"` or
 * no directories are provided.
 *
 * The synthetic `ROOT_SENTINEL_ID` is special: it's not a real
 * directory id, it doesn't appear in `directoriesById`, and
 * conventionally represents "the workspace root" — i.e. "any note
 * with no parent directory, plus any note in a top-level directory".
 * Without this expansion, picking `root` would silently match only
 * orphan notes (notes with `directory_ids.length === 0`), which is
 * almost never what the user wants when they click the obvious
 * "root" entry in the dropdown.
 *
 * In `subtree` mode we additionally walk the descendant tree of each
 * selected (and root-expanded) directory.
 *
 * `directoriesById` is the directory lookup table from
 * `useDirectoryStore` (id -> `DirectoryReply`). Each entry's
 * `child_dir_ids` provides the immediate children; we walk the tree
 * depth-first and accumulate.
 */
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

  // Expand the synthetic `root` sentinel to "every top-level
  // directory" regardless of scope. `passesFilter` separately treats
  // orphan notes as living under `root`, so this catches the rest.
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
