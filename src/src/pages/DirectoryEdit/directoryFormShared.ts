import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DirectoryApi,
  type ListDirectoriesQuery,
} from "../../api/DirectoryApi";
import type { DirectoryReply } from "../../api/models/directory";
import { useDirectoriesQuery } from "../../api/queries/directoryQueries";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";

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
 * Sentinel id for "no parent selected". We surface this as an explicit
 * option so the user can clear the autoselected parent before saving —
 * the `parent_ids` field on the create payload is then omitted
 * entirely.
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
 * Resolves a `parentId` selector value (one of the sentinels, or a
 * real directory id) into the `parent_ids` payload the
 * `DirectoryApi.setParent` and `CreateDirectoryBody` expect: `null`
 * for root / no parent, an array of one id otherwise. `null` is the
 * wire shape the API uses; the Create endpoint omits the field
 * entirely when callers pass `undefined`, but `setParent` rejects
 * `undefined` so we normalize to `null`.
 */
export const resolveParentIds = (parentId: string): string[] | null => {
  if (parentId === ROOT_PARENT_ID || parentId === NO_PARENT_ID) {
    return null;
  }
  return [parentId];
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
 * Runs the canonical `GET /api/directories` list query and keeps the
 * directory store in sync. Both `DirectoryEdit` and `DirectoryCreate`
 * use the same call so the parent picker can render directory names
 * immediately on mount.
 */
export function useDirectoryListHydration(): UseDirectoryListHydrationResult {
  const { directoriesById, setDirectories } = useDirectoryStore();

  const directoryListQuery = useMemo<ListDirectoriesQuery>(
    () => ({ limit: 500, offset: 0 }),
    [],
  );
  const { data: directories } = useDirectoriesQuery(directoryListQuery, true);

  useEffect(() => {
    if (directories) {
      setDirectories(directories);
    }
  }, [directories, setDirectories]);

  const sortedDirectories = useMemo(
    () =>
      Object.values(directoriesById).sort((a, b) =>
        labelOf(a).localeCompare(labelOf(b)),
      ),
    [directoriesById],
  );

  return { directoriesById, sortedDirectories };
}

export interface UseParentSelectorOptions {
  /**
   * Initial id to seed the selector with. Pass `undefined` to default
   * to the root sentinel; pass a real directory id to autoselect that
   * directory. The selector resolves the visible label from the
   * directory store once it hydrates.
   */
  initialId?: string;
  /**
   * Optional callback fired whenever the selector's id changes after
   * the user picks or types a value. Used by callers that need to
   * react to parent changes (e.g. invalidating a parent-specific
   * cache).
   */
  onChange?: (id: string) => void;
}

export interface UseParentSelectorResult {
  /** The resolved id (a sentinel or a real directory id). */
  parentId: string;
  /**
   * The raw text currently shown in the input. The user has full
   * control over this value: the hook never rewrites it after the
   * initial seed, so the input always shows exactly what was typed.
   */
  parentLabel: string;
  /**
   * Pure text setter. Stores `value` as both the label and the id;
   * the sentinel labels (`Root`, `(none — top level)`) are detected
   * and resolved to their sentinels, but the hook otherwise does
   * NOT try to match the typed text against the directory list.
   * The dropdown view is responsible for showing a "Use '<text>'"
   * option that the user clicks to confirm a custom value.
   */
  setParent: (value: string) => void;
  /**
   * True when the current label resolves to either:
   * - a sentinel (`Root`, `(none — top level)`), or
   * - a real directory id that's in the store, or
   * - a label that case-insensitively matches a known directory's
   *   display name.
   *
   * False when the user typed text that doesn't match anything
   * known. The view should render an error state on the input and
   * disable Save until the user either picks a valid option or
   * types text that resolves.
   */
  parentIsValid: boolean;
  /**
   * Returns the parent id to send to the API:
   * - `ROOT_PARENT_ID` for the Root sentinel,
   * - `NO_PARENT_ID` for the (none) sentinel,
   * - the real directory id when `parentIsValid` is true,
   * - the raw typed text when the value doesn't resolve.
   *
   * Callers should check `parentIsValid` first and refuse to save
   * when false; the raw text in the last branch is the surface area
   * for a clearer error message ("Parent '<text>' does not exist").
   */
  resolveForPayload: () => string;
}

/**
 * Owns the writable parent selector state shared by the Edit and
 * Create directory pages. The label is the raw text the user sees
 * in the input; the id is the same text (or a sentinel) used to
 * resolve the parent at save time.
 *
 * `setParent` is a pure text setter: it accepts whatever the user
 * typed and stores it. The hook does NOT try to silently match
 * typed text against the directory list — that's the caller's job
 * via the dropdown's "Use '<text>'" option. Validation is the
 * caller's responsibility: check `parentIsValid` before saving.
 *
 * The hook still recognises the two sentinel labels (`Root` and
 * `(none — top level)`) by name so picking them from the dropdown
 * or typing the literal label resolves to the right sentinel id.
 *
 * Use this hook together with the `Autocomplete` from MUI's
 * `freeSolo` mode. The page wires `value` and `inputValue` to
 * `parentLabel`, `onInputChange` and `onChange` to `setParent`,
 * and uses `filterOptions` to add a "Use '<text>'" option at the
 * top of the dropdown when the typed text doesn't match any
 * existing option.
 */
export function useParentSelector(
  sortedDirectories: DirectoryReply[],
  options: UseParentSelectorOptions = {},
): UseParentSelectorResult {
  const { initialId, onChange } = options;
  const { directoriesById } = useDirectoryStore();

  // One-time mount-time seed. The label is the directory's
  // display name (when the store has it) or empty when the
  // store hasn't hydrated yet. The hook does NOT keep a
  // reactive effect to re-resolve the label after mount — the
  // remount-on-route-change pattern in the views guarantees
  // that a fresh hook instance is created per directory.
  const seedFromStore = (id: string): string => {
    const record = directoriesById[id];
    return record ? labelOf(record) : "";
  };

  const initialLabel = (() => {
    if (!initialId) {
      return "";
    }
    if (initialId === ROOT_PARENT_ID) {
      return ROOT_PARENT_LABEL;
    }
    if (initialId === NO_PARENT_ID) {
      return NO_PARENT_LABEL;
    }
    // The directory may not be in the store yet; if not, the
    // label is empty and the user can type to replace it.
    return seedFromStore(initialId);
  })();

  const [parentId, setParentIdState] = useState<string>(
    initialId ?? ROOT_PARENT_ID,
  );
  const [parentLabel, setParentLabel] = useState<string>(initialLabel);
  // The last `initialId` we actually applied to the selector's
  // state. Used to detect when the caller passes a new seed
  // (e.g. the user navigated from editing directory A to
  // editing directory B and the route param changed) so we can
  // re-seed the selector. Without this the selector would
  // carry A's selection into the B dialog, which is exactly
  // the bug the reset behavior is meant to fix.
  const [appliedInitialId, setAppliedInitialId] = useState<string | undefined>(
    initialId,
  );

  // Re-seed the selector when the caller's `initialId` changes.
  // This happens when the route param changes and the parent
  // component passes a new seed (e.g. Edit page for A → Edit
  // page for B). We treat the new `initialId` as authoritative:
  // any prior user edit is discarded, matching the
  // route-is-source-of-truth pattern.
  useEffect(() => {
    if (initialId === appliedInitialId) {
      return;
    }
    setParentIdState(initialId ?? ROOT_PARENT_ID);
    setParentLabel(
      initialId === ROOT_PARENT_ID
        ? ROOT_PARENT_LABEL
        : initialId === NO_PARENT_ID
          ? NO_PARENT_LABEL
          : initialId
            ? seedFromStore(initialId)
            : "",
    );
    setAppliedInitialId(initialId);
  }, [initialId, appliedInitialId, directoriesById]);

  // Pure text setter. Detects the two sentinels (by id or by
  // label, case-insensitive) and resolves them; everything else
  // is stored as-is so the user always sees exactly what they
  // typed. The view is responsible for showing a "Use '<text>'"
  // option in the dropdown when the typed text doesn't match
  // any existing directory.
  const setParent = (value: string): void => {
    const trimmed = value.trim();
    if (trimmed === "") {
      // Empty input maps to "(none — top level)" so the id
      // isn't a garbage value. The user can still clear the
      // input — the label stays empty.
      setParentIdState(NO_PARENT_ID);
      setParentLabel("");
      onChange?.(NO_PARENT_ID);
      return;
    }
    if (trimmed === ROOT_PARENT_ID) {
      setParentIdState(ROOT_PARENT_ID);
      setParentLabel(ROOT_PARENT_LABEL);
      onChange?.(ROOT_PARENT_ID);
      return;
    }
    if (trimmed === NO_PARENT_ID) {
      setParentIdState(NO_PARENT_ID);
      setParentLabel(NO_PARENT_LABEL);
      onChange?.(NO_PARENT_ID);
      return;
    }
    const lower = trimmed.toLowerCase();
    if (lower === ROOT_PARENT_LABEL.toLowerCase()) {
      setParentIdState(ROOT_PARENT_ID);
      setParentLabel(ROOT_PARENT_LABEL);
      onChange?.(ROOT_PARENT_ID);
      return;
    }
    if (lower === NO_PARENT_LABEL.toLowerCase()) {
      setParentIdState(NO_PARENT_ID);
      setParentLabel(NO_PARENT_LABEL);
      onChange?.(NO_PARENT_ID);
      return;
    }
    // Otherwise: store the typed text as-is. The hook makes no
    // attempt to match against the directory list — the user
    // is in full control, and validation is deferred to save
    // time.
    setParentIdState(trimmed);
    setParentLabel(trimmed);
    onChange?.(trimmed);
  };

  // Validates the current label against the directory store
  // and the two sentinels. The label is valid if it matches a
  // known directory's id (which would only happen after a
  // remount with `initialId`), a known directory's display
  // name (case-insensitive exact match), or one of the two
  // sentinel labels. The empty label is treated as the
  // `(none — top level)` choice and is valid.
  const parentIsValid = (() => {
    if (parentLabel === "") {
      return true;
    }
    if (parentId === ROOT_PARENT_ID || parentId === NO_PARENT_ID) {
      return true;
    }
    if (directoriesById[parentId]) {
      return true;
    }
    const lower = parentLabel.toLowerCase();
    if (lower === ROOT_PARENT_LABEL.toLowerCase()) {
      return true;
    }
    if (lower === NO_PARENT_LABEL.toLowerCase()) {
      return true;
    }
    return sortedDirectories.some((d) => labelOf(d).toLowerCase() === lower);
  })();

  // Returns the parent id to send to the API, or the raw typed
  // text when the value doesn't resolve. Callers should check
  // `parentIsValid` first and refuse to save when false.
  const resolveForPayload = (): string => {
    if (parentId === ROOT_PARENT_ID || parentId === NO_PARENT_ID) {
      return parentId;
    }
    if (directoriesById[parentId]) {
      return parentId;
    }
    if (parentLabel === "") {
      return NO_PARENT_ID;
    }
    const lower = parentLabel.toLowerCase();
    if (lower === ROOT_PARENT_LABEL.toLowerCase()) {
      return ROOT_PARENT_ID;
    }
    if (lower === NO_PARENT_LABEL.toLowerCase()) {
      return NO_PARENT_ID;
    }
    const match = sortedDirectories.find(
      (d) => labelOf(d).toLowerCase() === lower,
    );
    return match ? match.id : parentLabel;
  };

  return {
    parentId,
    parentLabel,
    setParent,
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
