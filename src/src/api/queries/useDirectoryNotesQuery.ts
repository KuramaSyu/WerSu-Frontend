import { useQuery } from "@tanstack/react-query";
import { getDirectoryApi, type ListDirectoryNotesQuery } from "../DirectoryApi";
import type { NotesReply } from "../models/search";
import { mergeTagsFromNotesReply } from "../../zustand/useTagStore";
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
 * Fetches the notes attached to a directory via
 * `GET /api/directories/:id/notes/?limit=...&offset=...`.
 *
 * tags from the reply are forwarded into the tag store via
 * `mergeTagsFromNotesReply`; the query returns the reply as-is.
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
      const reply = await directoryApi.listNotes(directoryId, query);
      mergeTagsFromNotesReply(reply);
      return reply;
    },
    enabled: !!directoryId,
  });
}
