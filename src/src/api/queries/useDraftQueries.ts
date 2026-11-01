import { useMemo } from "react";
import {
  useDraftStore,
  getDraftUrgencyScore,
  type DraftEntry,
} from "../../zustand/useDraftStore";

/**
 * Draft-state source of truth.
 *
 * Today this reads the local-only tracker (`useDraftStore`). When
 * cross-device sync lands, swap the body for a react-query query and
 * hydrate the tracker, e.g.:
 *
 * ```ts
 * const query = useQuery({
 *   queryKey: ["drafts"],
 *   queryFn: fetchDrafts,        // GET /api/drafts
 * });
 * useEffect(() => {
 *   if (query.data) useDraftStore.getState().setDrafts(query.data);
 * }, [query.data]);
 * return { draftsById: useDraftStore((s) => s.drafts), isLoading: query.isLoading };
 * ```
 *
 * Keep the return shape (`DraftStates`) stable so no caller changes.
 */
export interface DraftStates {
  /** noteId -> draft entry. */
  draftsById: Record<string, DraftEntry>;
  /** True while draft state is being resolved (always false for local). */
  isLoading: boolean;
}

export function useDraftStates(): DraftStates {
  const draftsById = useDraftStore((s) => s.drafts);
  return { draftsById, isLoading: false };
}

/**
 * Draft note ids ordered most-urgent-first (change volume × session
 * age). Returned as a plain array so a row can render one card per
 * draft.
 *
 * The score is sampled when `draftsById` changes, so within a single
 * render pass ordering is stable even though the score technically
 * depends on wall-clock time.
 */
export function useDraftNoteIds(): string[] {
  const { draftsById } = useDraftStates();
  return useMemo(
    () =>
      Object.values(draftsById)
        .sort((a, b) => getDraftUrgencyScore(b) - getDraftUrgencyScore(a))
        .map((entry) => entry.noteId),
    [draftsById],
  );
}
