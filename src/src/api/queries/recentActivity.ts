import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { UserApi } from "../UserApi";
import { useAuthStore } from "../../zustand/useAuthStore";
import {
  DiscordUserImpl,
  type DiscordUser,
} from "../../components/DiscordLogin";
import { getActivityApi } from "../ActivityApi";
import type { NoteVersionSummaryReply } from "../models/activity";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const activityApi = getActivityApi();

/**
 * Hook to fetch the activity / versions for a specific note
 * @returns NoteVersionSummaryReply[] - list of versions with metadata, but no content
 */
export function useNoteActivity(
  noteId: string,
): UseQueryResult<NoteVersionSummaryReply[], Error> {
  return useQuery({
    queryKey: ["activity", "note", noteId],
    queryFn: async () => {
      return await activityApi.getNoteActivity(noteId);
    },
  });
}
