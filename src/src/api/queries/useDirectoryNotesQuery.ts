import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi, type ListDirectoryNotesQuery } from "../DirectoryApi";
import type { NotesReply } from "../models/search";
import { useTagStore } from "../../zustand/useTagStore";
import { useUserKey } from "./useUser";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const directoryApi = getDirectoryApi();

export const directoryNotesQueryKeys = {
  all: ["directory", "notes"] as const,
  list: (
    userKey: string | null,
    directoryId: string,
    query: ListDirectoryNotesQuery = {},
  ) => ["directory", "notes", directoryId, query, userKey] as const,
};

/**
 * Forwards `MinimalTag` rows from the reply into the tag store so
 * callers that subscribe to `useTagStore` see fresh labels without
 * an extra fetch. The inline `MinimalDirectory` entries are ignored
 * here — directory metadata is sourced from `useAllDirectoriesQuery`,
 * not from these note-reply payloads.
 */
const mergeNotesReplyIntoStores = (reply: NotesReply): NotesReply => {
  if (reply.tags.length > 0) {
    useTagStore.getState().upsertTags(reply.tags);
  }
  return reply;
};

/**
 * Fetches the notes attached to a directory via
 * `GET /api/directories/:id/notes/?limit=...&offset=...`.
 *
 * The backend always returns the directory's `README.md` note (with full
 * `content` carried in `stripped_content`) on the first page; other notes
 * are returned with stripped content only.
 *
 * Returns a `NotesReply` so consumers that need the note list directly
 * can read `data.notes`; consumers that want a flat array can use the
 * `.notes` field via `select`. Inline `MinimalTag` rows are mirrored
 * into the tag store so the rest of the app picks up referenced
 * labels without an extra fetch.
 */
export function useDirectoryNotesQuery(
  directoryId?: string,
  query: ListDirectoryNotesQuery = {},
) {
  const userKey = useUserKey();
  return useQuery<NotesReply>({
    queryKey: directoryNotesQueryKeys.list(userKey, directoryId ?? "", query),
    queryFn: async () => {
      if (!directoryId) {
        throw new Error("directoryId required");
      }
      return mergeNotesReplyIntoStores(
        await directoryApi.listNotes(directoryId, query),
      );
    },
    enabled: !!directoryId,
  });
}
