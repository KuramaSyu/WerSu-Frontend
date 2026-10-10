import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AttachmentApi } from "../AttachmentApi";
import type {
  AttachmentMetadata,
  UpdateAttachmentRequest,
} from "../models/attachment";
import { SearchNotesApi, type ISearchNotesApi } from "../SearchNotesApi";
import { Note, RestNotesSearchType, type MinimalNote } from "../models/search";
import { getNoteApi, type INoteApi } from "../NoteApi";
import { updateNoteParentDirectory } from "../../utils/updateNoteParentDirectory";
import { usePublicRouteReady } from "../../hooks/usePublicRouteReady";
import { useAuthStore } from "../../zustand/useAuthStore";
import { useUserStore } from "../../zustand/userStore";

const searchNotesApi: ISearchNotesApi = new SearchNotesApi();
const noteApi: INoteApi = getNoteApi();

export const noteQueries = {
  /**
   * Default list shown in main screen with the latest 50 entries.
   * The queryFn unwraps `NotesReply` to `MinimalNote[]` so the
   * optimistic `useCreateNote` and the consumer in `MainContent`
   * can treat the cache as a flat note list.
   */
  list: () => ({
    queryKey: ["notes"],

    queryFn: async (): Promise<MinimalNote[]> => {
      const reply = await searchNotesApi.search(
        RestNotesSearchType.LATEST,
        "",
        {
          limit: 50,
          offset: 0,
        },
      );
      return reply.notes;
    },
  }),

  /**
   * Search notes.
   * @returns MinimalNote[] -- each page is one `NotesReply.notes` array.
   */
  search: (
    searchType: RestNotesSearchType,
    query: string,
    limit: number,
    offset: number,
  ) => ({
    queryKey: ["notes", "search", searchType, query, limit, offset],

    queryFn: async (): Promise<MinimalNote[]> => {
      const reply = await searchNotesApi.search(searchType, query, {
        limit,
        offset,
      });
      return reply.notes;
    },
  }),

  /**
   * Full note details with permissions and full content
   * @returns Note
   */
  detail: (noteId: string) => ({
    queryKey: ["notes", noteId],

    queryFn: () => noteApi.get(noteId),
  }),
};

// hooks

/**
 * for the main view
 *
 * @usage ```ts
 * const{data: notes = [] } = useNotes();
 * ```
 *
 * @returns MinimalNote[] of the latest 50 notes
 */
export function useLatestNotes() {
  return useQuery(noteQueries.list());
}

/**
 * @usage ```ts
 * const { data, fetchNextPage, hasNextPage } = useInfinitNoteSearch(RestNotesSearchType.CONTEXT, searchText);
 * const notes = data?.pages.flat() ?? [];
 * @returns MinimalNotes[]
 */
export function useInfiniteNoteSearch(
  searchType: RestNotesSearchType,
  query: string,
  limit = 20,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ["notes", "search", searchType, query],

    /**
     * pageParam is our offset.
     * First page starts with offset=0
     */
    queryFn: ({ pageParam = 0 }) =>
      noteQueries.search(searchType, query, limit, pageParam).queryFn(),

    /**
     * determines pageParam = offset for the next call
     */
    getNextPageParam: (lastPage, allPages) => {
      console.log("lastPage", lastPage);
      if (lastPage.length < limit) {
        return undefined;
      }
      return allPages.length * limit;
    },

    initialPageParam: 0,
    enabled,
  });
}

/**
 * Get a note with all details.
 * Public routes wait on the share JWT; private routes use the cookie.
 */
export function useNote(noteId?: string, ready?: boolean) {
  return useQuery({
    queryKey: ["notes", noteId],

    queryFn: () => {
      if (!noteId) {
        throw new Error("noteId required");
      }
      return noteApi.get(noteId);
    },

    // note given and either JWT provided or user logged in
    enabled: !!noteId && ready,
  });
}

/**
 * Fetch a specific historical version of a note. Disabled when
 * `noteId` or `versionIndex` is missing, which lets the caller
 * short-circuit (e.g. skip the fetch when the selection already
 * matches the latest version).
 */
export function useNoteVersion(noteId?: string, versionIndex?: number) {
  return useQuery({
    queryKey: ["notes", noteId, "version", versionIndex],

    queryFn: () => {
      if (!noteId || versionIndex === undefined) {
        throw new Error("noteId and versionIndex required");
      }
      return noteApi.getVersion(noteId, versionIndex);
    },

    enabled: !!noteId && versionIndex !== undefined,
  });
}

/**
 * Variables accepted by the `useUpdateNote` mutation. Mirrors the
 * patch API: title, content, and the parent / tag relationships are
 * all optional because each call only sends the fields that actually
 * changed (see `NotePage`).
 */
export interface UpdateNoteVariables {
  noteId: string;
  title?: string;
  content?: string;
  directory_ids?: string[];
  tag_ids?: string[];
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      title,
      content,
      directory_ids,
      tag_ids,
    }: UpdateNoteVariables) =>
      noteApi.patch(noteId, title, content, directory_ids, tag_ids),

    /**
     * refresh detail cache instantly
     */
    onSuccess: (updatedNote) => {
      queryClient.setQueryData(["notes", updatedNote.id], updatedNote);

      // Refresh notes lists and searches
      queryClient.invalidateQueries({
        queryKey: ["notes"],
      });
    },
  });
}

/**
 * @usage ```ts
 * const createNote = useCreateNote();
 * const note = await createNote.mutateAsync({title: "hunter x hunter", content: "one of the best animes"})
 * ```
 * @returns factory to create notes
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      title,
      content,
      shelf_id,
      directory_ids,
    }: {
      title: string;
      content: string;
      shelf_id?: string;
      directory_ids?: string[];
    }) =>
      noteApi.post(title, content, {
        shelf_id,
        directory_ids,
      }),

    onSuccess: (createdNote) => {
      // update "notes" e.g. latest 50
      queryClient.setQueryData(["notes"], (old: MinimalNote[] = []) => [
        createdNote,
        ...old,
      ]);

      queryClient.setQueryData(["notes", createdNote.id], createdNote);

      // Update the detail cache
      queryClient.setQueryData(["notes", createdNote.id], createdNote);
    },
  });
}

/**
 * deletes a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => noteApi.delete(noteId),

    // when calling .mutate, noteId is the parameter passed into mutate
    onSuccess: (_, noteId) => {
      // remove detail cache
      queryClient.removeQueries({
        queryKey: ["notes", noteId],
      });

      // refresh all lists/searches
      queryClient.invalidateQueries({
        queryKey: ["notes"],
      });
    },
  });
}

/**
 * changes the parent directory of a note and removes all other parent dirs.
 * If directory is undefined, then the note will belong to the root directory
 */
export function useMoveNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      directoryId,
    }: {
      noteId: string;
      directoryId?: string;
    }) => noteApi.patchDirectory(noteId, directoryId),

    // when calling .mutate, noteId is the parameter passed into mutate
    onSuccess: (_, noteId) => {
      // remove detail cache
      queryClient.removeQueries({
        queryKey: ["notes", noteId],
      });

      // refresh all lists/searches
      queryClient.invalidateQueries({
        queryKey: ["notes"],
      });
    },

    // patch the note permissions and update it
    onMutate: async ({ noteId, directoryId }) => {
      await queryClient.cancelQueries({
        queryKey: ["notes", noteId],
      });

      const previous = queryClient.getQueryData<Note>(["notes", noteId]);
      queryClient.setQueryData(["notes", noteId], (note: Note | undefined) => {
        if (!note) {
          return note;
        }

        return updateNoteParentDirectory(previous!, directoryId);
      });
    },

    onSettled: (_, __, variables) => {
      // invalidate default view
      queryClient.invalidateQueries({
        queryKey: ["notes"],
        exact: true,
      });

      // invalidate searches
      queryClient.invalidateQueries({
        queryKey: ["notes", "search"],
      });
    },
  });
}
