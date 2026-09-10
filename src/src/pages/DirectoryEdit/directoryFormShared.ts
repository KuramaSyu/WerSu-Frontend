import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DirectoryApi,
  type ListDirectoriesQuery,
} from "../../api/DirectoryApi";
import type { DirectoryReply } from "../../api/models/directory";
import { useAllDirectoriesQuery } from "../../api/queries/directoryQueries";

/**
 * Shared building blocks for the `DirectoryEdit` and
 * `DirectoryCreate` pages. The two pages collect the same form
 * fields (name / description / parent / image) and back them with the
 * same directory store hydration; centralising those primitives keeps
 * the two pages from drifting and lets the shared
 * `useDirectoryFormShell` hook consume a single source of truth.
 *
 * Pure helpers live at the top of the file; reusable hooks follow.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Sentinel id for the synthetic root in the parent picker. Matches
 * the value used in `DirectoryEdit` and the file graph so a "Root"
 * choice round-trips consistently across the app.
 */
export const ROOT_PARENT_ID = "root";

/**
 * Sentinel id for "no parent selected". Kept for backward
 * compatibility with code that still reads the single-parent hook;
 * the chip picker no longer surfaces it as a dropdown row, treating
 * the empty selection as top-level instead.
 */
export const NO_PARENT_ID = "__none__";

/**
 * Display label for the root option in the parent autocomplete. Used
 * to match free-text input ("root", "Root", "ROOT") back to the root
 * sentinel when the user types rather than picks from the dropdown.
 */
export const ROOT_PARENT_LABEL = "Root";

/**
 * Display label for the "(none)" option in the parent autocomplete.
 */
export const NO_PARENT_LABEL = "(none — top level)";

// ---------------------------------------------------------------------------
// Pure resolvers
// ---------------------------------------------------------------------------

/**
 * Resolves a parent id list into the `parent_ids` payload the
 * `DirectoryApi.setParent` and `CreateDirectoryBody` expect: `null`
 * for top-level (empty list), an array of ids otherwise. Sentinels
 * (`ROOT_PARENT_ID`, `NO_PARENT_ID`) are filtered out so the wire
 * payload stays a clean list of real directory ids.
 */
export const resolveParentIds = (
  parentIds: readonly string[] | null,
): string[] | null => {
  if (parentIds === null || parentIds.length === 0) {
    return null;
  }
  const real = parentIds.filter(
    (id) => id !== ROOT_PARENT_ID && id !== NO_PARENT_ID,
  );
  return real.length > 0 ? real : null;
};

/**
 * Returns the display label for a directory record, with a stable
 * fallback chain. Centralised so the parent picker, the directory
 * tree, and the home grid all show the same string for the same
 * record.
 */
export const labelOf = (directory: DirectoryReply): string =>
  directory.display_name ?? directory.name ?? directory.slug ?? directory.id;

// ---------------------------------------------------------------------------
// Shared hooks
// ---------------------------------------------------------------------------

export interface UseDirectoryListHydrationResult {
  /** The directory store, keyed by id. */
  directoriesById: Record<string, DirectoryReply>;
  /** All directories, sorted by display name. */
  sortedDirectories: DirectoryReply[];
}

/**
 * Runs the canonical `GET /api/directories` list query and exposes
 * the result as a sorted array plus a lookup map. Both `DirectoryEdit`
 * and `DirectoryCreate` use the same call so the parent picker can
 * render directory names immediately on mount.
 */
export function useDirectoryListHydration(): UseDirectoryListHydrationResult {
  const { list: directories, byId: directoriesById } = useAllDirectoriesQuery();

  const sortedDirectories = useMemo(
    () =>
      directories
        ? [...directories].sort((a, b) => labelOf(a).localeCompare(labelOf(b)))
        : [],
    [directories],
  );

  return { directoriesById, sortedDirectories };
}

export interface UseParentIdsOptions {
  /** Initial id list to seed the selector with. */
  initialIds?: readonly string[];
  /**
   * Optional callback fired whenever the user changes the selection.
   * Callers use it to react to parent changes (e.g. invalidating a
   * parent-specific cache).
   */
  onChange?: (ids: string[]) => void;
}

export interface UseParentIdsResult {
  /** Currently selected directory ids. Empty array means top-level. */
  parentIds: string[];
  /** Replace the selection. */
  setParentIds: (ids: string[]) => void;
  /**
   * True when every id in parentIds resolves to a known directory.
   * Top-level (empty array) is valid by definition.
   */
  parentIsValid: boolean;
  /**
   * Returns the parent id list to send to the API. null means
   * top-level; an array of ids means "live under those parents".
   * Callers should check parentIsValid first.
   */
  resolveForPayload: () => string[] | null;
}

/**
 * Owns the writable parent-id list shared by the Edit and Create
 * directory pages. The list is the source of truth for save; the
 * chip picker is the only UI surface that touches it. The hook
 * keeps a stable seed-on-mount pattern so navigating from editing
 * directory A to editing directory B re-initialises with B's
 * data (the view keys the form body on the route id).
 */
export function useParentIds(
  sortedDirectories: DirectoryReply[],
  options: UseParentIdsOptions = {},
): UseParentIdsResult {
  const { initialIds, onChange } = options;

  // Local lookup derived from the passed-in sorted list. The hook
  // intentionally does not subscribe to any global store here so
  // callers control when the directory pool refreshes.
  const directoriesById = useMemo<Record<string, DirectoryReply>>(() => {
    const map: Record<string, DirectoryReply> = {};
    for (const directory of sortedDirectories) {
      map[directory.id] = directory;
    }
    return map;
  }, [sortedDirectories]);

  // Capture the seed once on mount: re-deriving it every render
  // would re-evaluate `initialIds` (a fresh array every time the
  // shell recomputes its inline IIFE) and re-run the effect below,
  // looping forever.
  const [seedIds] = useState<string[]>(() => {
    if (!initialIds || initialIds.length === 0) {
      return [];
    }
    return initialIds.filter(
      (id) =>
        id === ROOT_PARENT_ID ||
        directoriesById[id] !== undefined ||
        sortedDirectories.some((d) => d.id === id),
    );
  });

  const [parentIds, setParentIdsState] = useState<string[]>(seedIds);
  // Track the most recently observed `initialIds` reference so a
  // route change (or any other caller-driven seed update) can
  // re-seed the picker without colliding with the mount-time seed.
  const [appliedSeed, setAppliedSeed] = useState<unknown>(initialIds);

  // Re-seed only when `initialIds` changes by reference. Comparing
  // by value isn't an option because the shell currently hands us
  // a fresh array on every render; the hook layer is the one place
  // that needs to gate the re-seed.
  useEffect(() => {
    if (initialIds === appliedSeed) {
      return;
    }
    setParentIdsState(
      initialIds ? [...initialIds.filter((id) => id !== ROOT_PARENT_ID)] : [],
    );
    setAppliedSeed(initialIds);
  }, [initialIds, appliedSeed]);

  const setParentIds = (ids: string[]): void => {
    setParentIdsState(ids);
    onChange?.(ids);
  };

  const parentIsValid = parentIds.every(
    (id) => id === ROOT_PARENT_ID || directoriesById[id] !== undefined,
  );

  const resolveForPayload = (): string[] | null => {
    if (parentIds.length === 0) {
      return null;
    }
    // Filter out any stray sentinel ids so the wire payload stays
    // a clean list of real directory ids.
    return parentIds.filter((id) => id !== ROOT_PARENT_ID);
  };

  return {
    parentIds,
    setParentIds,
    parentIsValid,
    resolveForPayload,
  };
}

/**
 * Creates / revokes a stable object URL for a picked `File`. The
 * shared `useDirectoryFormShell` exposes the resulting URL so the
 * view can render a preview without leaking the underlying Blob
 * between selections.
 */
export function useObjectUrl(source: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!source) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(source);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [source]);
  return url;
}

/**
 * Invalidates every cache that depends on the directory list / tree
 * after a directory create or update. Both pages run the same set of
 * invalidations on success so a single helper avoids drift.
 */
export function invalidateDirectoryQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userKey: string | null,
  directoryId?: string,
  parentId?: string,
): void {
  queryClient.invalidateQueries({ queryKey: ["directories"] });
  if (directoryId) {
    queryClient.invalidateQueries({
      queryKey: ["directory", directoryId, userKey],
    });
    queryClient.invalidateQueries({
      queryKey: ["directory", "notes", directoryId, userKey],
    });
  }
  if (parentId) {
    queryClient.invalidateQueries({
      queryKey: ["directory", parentId, userKey],
    });
  }
  queryClient.invalidateQueries({ queryKey: ["notes"] });
}

/**
 * Convenience re-export so callers don't need to import the API
 * surface directly. Wraps `DirectoryApi` construction in a singleton
 * pattern matching the rest of the app.
 */
export const createDirectoryApi = () => new DirectoryApi();
