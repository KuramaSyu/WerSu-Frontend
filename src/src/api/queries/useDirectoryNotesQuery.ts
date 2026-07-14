import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi, type ListDirectoryNotesQuery } from "../DirectoryApi";
import type { NotesReply } from "../models/search";
import { useDirectoryStore } from "../../zustand/useDirectoryStore";
import { useTagStore } from "../../zustand/useTagStore";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const directoryApi = getDirectoryApi();

export const directoryNotesQueryKeys = {
  all: ["directory", "notes"] as const,
  list: (directoryId: string, query: ListDirectoryNotesQuery = {}) =>
    ["directory", "notes", directoryId, query] as const,
};

/**
 * Mirrors the embedded `MinimalDirectory` / `MinimalTag` entries into
 * the directory and tag stores. Same store-mutation pattern as the
 * search query — the backend now bundles them inline.
 */
const mergeNotesReplyIntoStores = (reply: NotesReply): NotesReply => {
  const upsertMinimalDirectory =
    useDirectoryStore.getState().upsertMinimalDirectory;
  const upsertTags = useTagStore.getState().upsertTags;
  for (const directory of reply.directories) {
    upsertMinimalDirectory(directory);
  }
  if (reply.tags.length > 0) {
    upsertTags(reply.tags);
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
 * `.notes` field via `select`. The full reply is also mirrored into the
 * directory and tag stores so the rest of the app picks up referenced
 * labels without an extra fetch.
 */
export function useDirectoryNotesQuery(
  directoryId?: string,
  query: ListDirectoryNotesQuery = {},
) {
  return useQuery<NotesReply>({
    queryKey: directoryNotesQueryKeys.list(directoryId ?? "", query),
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
