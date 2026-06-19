import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { UserApi } from "../UserApi";
import { useAuthStore } from "../../zustand/useAuthStore";
import {
  DiscordUserImpl,
  type DiscordUser,
} from "../../components/DiscordLogin";
import { ActivityApi } from "../ActivityApi";
import type { NoteVersionSummaryReply } from "../models/activity";

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
      return await new ActivityApi().getNoteActivity(noteId);
    },
  });
}
