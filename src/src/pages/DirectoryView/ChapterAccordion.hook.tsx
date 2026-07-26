import { useState } from "react";
import type { DirectoryReply } from "../../api/models/directory";
import type { MinimalNote } from "../../api/models/search";
import {
  useDirectoriesQuery,
  useDirectoryByIdQuery,
} from "../../api/queries/directoryQueries";
import { useDirectoryNotesQuery } from "../../api/queries/useDirectoryNotesQuery";
import { useThemeStore } from "../../zustand/useThemeStore";
import { directoryColors, noteColors } from "./directoryAccent";

/**
 * Public state and derivations for `ChapterAccordion`.
 *
 * Owns:
 * - Hydration of the full `DirectoryReply` via the per-id query so
 *   the row badge has accurate `child_note_ids` / `child_dir_ids`
 *   before the user expands.
 * - Expansion state (`expanded`, `setExpanded`) plus the
 *   `closeAnimationCompleted` flag used to gate the empty-state
 *   Typography during the MUI collapse animation.
 * - Body data: the children + notes fetch, the README filter,
 *   and the derived `isLoading` / `isEmpty` / `showEmptyState`.
 * - Theme-derived accent colors (so the component can stay pure JSX).
 */
export interface UseChapterAccordionResult {
  /** The hydrated `DirectoryReply`, falling back to the prop. */
  hydratedDirectory: DirectoryReply;
  /** Whether the accordion is currently expanded. */
  expanded: boolean;
  /** Chevron click handler. Stops propagation so the row click handler doesn't navigate. */
  toggleExpanded: (e: React.MouseEvent) => void;
  /** True once the close animation has finished. Reset on the next open. */
  closeAnimationCompleted: boolean;
  /** Mark the close animation as completed. */
  markCloseAnimationCompleted: () => void;
  /** Reset the close-animation flag on the next open. */
  markOpenAnimationStarted: () => void;
  /** Direct child directories of the chapter. */
  subdirectories: DirectoryReply[];
  /** Notes belonging to the chapter, README excluded. */
  notes: MinimalNote[];
  isLoading: boolean;
  isEmpty: boolean;
  showEmptyState: boolean;
  /** Accent color for the current row's primary bar. */
  accentColor: string;
  /** Accent color for the alternating row + alternating note bar. */
  noteAccent: string;
  noteAccentAlt: string;
  primaryAccentAlt: string;
}

/**
 * All non-render logic for `ChapterAccordion`.
 *
 * Keeps the component file to pure JSX so its layout reads at a
 * glance; this hook owns every state, side-effect, and derivation.
 */
export function useChapterAccordion(
  directory: DirectoryReply,
  index: number,
): UseChapterAccordionResult {
  const { theme } = useThemeStore();

  // Hydrate the full DirectoryReply via `useDirectoryByIdQuery` so the
  // row badge has accurate `child_note_ids` / `child_dir_ids` even
  // before the user expands. The query is deduped by id via React
  // Query's cache, so nested accordions sharing a directory id
  // (rare but possible) share the same in-flight request.
  //
  // Merge strategy: the per-id reply wins for fields it actually
  // populates; the prop wins for fields the per-id endpoint strips.
  // In practice `GET /api/directories/:id` may omit `child_note_ids`
  // (the same default `include_child_notes: false` we see on the
  // per-parent list call) - a naive `data ?? prop` then strips the
  // populated values we got from the list call and the badge falls
  // back to "Empty" for every row.
  const directoryByIdQuery = useDirectoryByIdQuery(directory.id);
  const reply = directoryByIdQuery.data;
  const hydratedDirectory: DirectoryReply = {
    ...directory,
    ...(reply ?? {}),
    child_note_ids: reply?.child_note_ids ?? directory.child_note_ids ?? [],
    child_dir_ids: reply?.child_dir_ids ?? directory.child_dir_ids ?? [],
  };

  // Expansion state and close-animation gating.
  const [expanded, setExpanded] = useState(false);
  // Tracks whether the MUI collapse transition has finished. While
  // the accordion is closing we suppress the empty-state message so
  // users never see a flash of "This chapter is empty." during the
  // animation. Reset on the next open so the gating works for every
  // close cycle.
  const [closeAnimationCompleted, setCloseAnimationCompleted] = useState(false);

  // Lazy fetch - enabled only after the user expands the accordion
  // for the first time. React Query still dedupes by queryKey on
  // subsequent opens.
  //
  // `include_child_notes: true` so the nested `ChapterAccordion`s
  // rendered below receive a prop with populated `child_note_ids`.
  // Without it, the nested rows would always show "Empty" because
  // neither the per-parent fetch nor the per-id `GET /api/directories/:id`
  // populates that field by default.
  const subdirectoriesQuery = useDirectoriesQuery(
    {
      parent_id: directory.id,
      limit: 500,
      offset: 0,
      include_child_notes: true,
    },
    expanded,
  );

  const notesQuery = useDirectoryNotesQuery(
    // Only load when expanded to prevent unnecessary fetches;
    // `!closeAnimationCompleted` keeps the query alive during the
    // close animation so cached data doesn't disappear mid-collapse.
    expanded || !closeAnimationCompleted ? directory.id : undefined,
    { limit: 500, offset: 0 },
  );

  const [primaryAccent, primaryAccentAlt] = directoryColors(theme);
  const [noteAccent, noteAccentAlt] = noteColors(theme);
  const accentColor = index % 2 === 0 ? primaryAccent : primaryAccentAlt;

  const subdirectories = subdirectoriesQuery.data ?? [];
  // Drop the README note from the listing - the backend returns it as
  // the first entry of the directory's notes list.
  const notes = (notesQuery.data?.notes ?? []).filter(
    (n) => n.title !== "README.md",
  );
  const isLoading =
    expanded && (subdirectoriesQuery.isLoading || notesQuery.isLoading);
  // A directory is empty when it has no subdirectories and no user
  // notes. The title-based README filter above already removed the
  // README, so `notes.length` is the user-note count directly - 0
  // is empty, 1 is "one note, not empty".
  const isEmpty =
    !isLoading && subdirectories.length === 0 && notes.length === 0;
  // Only render the empty-state once the accordion has finished its
  // close animation - otherwise the message flashes in for ~300ms
  // while the body collapses.
  const showEmptyState = isEmpty && (expanded || closeAnimationCompleted);

  // Chevron click handler. Stops propagation so the row-level click
  // handler doesn't also fire (which would navigate away).
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return {
    hydratedDirectory,
    expanded,
    toggleExpanded,
    closeAnimationCompleted,
    markCloseAnimationCompleted: () => setCloseAnimationCompleted(true),
    markOpenAnimationStarted: () => setCloseAnimationCompleted(false),
    subdirectories,
    notes,
    isLoading,
    isEmpty,
    showEmptyState,
    accentColor,
    noteAccent,
    noteAccentAlt,
    primaryAccentAlt,
  };
}
