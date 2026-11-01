// Notes reached through the search endpoint, scoped to a shelf and/or
// directory. The shares API only filters by note id, so the /shares page
// uses this hook to resolve which notes (and titles) live in the current
// scope before intersecting them with the share list.

import { useQuery } from "@tanstack/react-query";
import { SearchNotesApi } from "../SearchNotesApi";
import { RestNotesSearchType, type MinimalNote } from "../models/search";
import { useIsAuthenticated } from "./useUser";

// Plain instance (not the registry singleton) to mirror `useNoteQueries`.
const searchNotesApi = new SearchNotesApi();

export interface NotesByScopeRequest {
  /** Restrict to notes bound to this shelf. */
  shelfId?: string;
  /** Restrict to notes whose parent directory is this directory. */
  directoryId?: string;
  /** Page size handed to the search endpoint. */
  limit?: number;
}

export const notesByScopeQueryKeys = {
  all: ["notes", "byScope"] as const,
  list: (request: NotesByScopeRequest) =>
    [...notesByScopeQueryKeys.all, request] as const,
};

/**
 * Fetch the notes in the given scope.
 *
 * With no `shelfId` and no `directoryId` this degrades to the latest
 * notes list, which supplies titles for the unscoped all-shares page.
 */
export function useNotesByScope(request: NotesByScopeRequest) {
  const isAuthed = useIsAuthenticated();
  const { shelfId, directoryId, limit = 500 } = request;

  return useQuery({
    queryKey: notesByScopeQueryKeys.list({ shelfId, directoryId, limit }),
    queryFn: async (): Promise<MinimalNote[]> => {
      const reply = await searchNotesApi.search(
        RestNotesSearchType.LATEST,
        "",
        {
          limit,
          offset: 0,
          include_shelf_ids: shelfId ? [shelfId] : undefined,
          include_directory_ids: directoryId ? [directoryId] : undefined,
        },
      );
      return reply.notes;
    },
    enabled: isAuthed,
  });
}
