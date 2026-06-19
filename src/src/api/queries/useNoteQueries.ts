import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { AttachmentApi } from "../AttachmentApi";
import type {
  AttachmentMetadata,
  UpdateAttachmentRequest,
} from "../models/attachment";
import { SearchNotesApi, type ISearchNotesApi } from "../SearchNotesApi";
import {
  Note,
  RestNotesSearchType,
  type MinimalNote,
  type NoteData,
} from "../models/search";
import { NoteApi, type INoteApi } from "../NoteApi";
import { updateNoteParentDirectory } from "../../utils/updateNoteParentDirectory";
import { DiscordUserImpl } from "../../components/DiscordLogin";

const searchNotesApi: ISearchNotesApi = new SearchNotesApi();
const noteApi: INoteApi = new NoteApi();

export const noteQueries = {
  /**
   * Default list shown in main screen with the latest 50 entries
   */
  list: () => ({
    queryKey: ["notes"],

    queryFn: () => searchNotesApi.search(RestNotesSearchType.LATEST, "", 50, 0),
  }),

  /**
   * Search notes.
   * @returns MinimalNote[]
   */
  search: (
    searchType: RestNotesSearchType,
    query: string,
    limit: number,
    offset: number,
  ) => ({
    queryKey: ["notes", "search", searchType, query, limit, offset],

    queryFn: () => searchNotesApi.search(searchType, query, limit, offset),
  }),

  /**
   * Full note details with permissions and full content
   * @returns Note
   */
  detail: (noteId: string) => ({
    queryKey: ["notes", noteId],

    queryFn: () => noteApi.get(noteId),

    select: (data: NoteData) => new Note(data as NoteData),
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
      if (lastPage.length < limit) {
        return undefined;
      }
      return allPages.length * limit;
    },

    initialPageParam: 0,
  });
}

/**
 * get a note with all details
 * @param noteId id of note
 * @returns Note
 */
export function useNote(noteId?: string) {
  return useQuery({
    queryKey: ["notes", noteId],

    queryFn: () => {
      if (!noteId) {
        throw new Error("noteId reuqired");
      }
      return noteApi.get(noteId);
    },

    enabled: !!noteId,

    select: (data) => new Note({ ...data } as NoteData),
  });
}

/**
 * get a note with all details
 * @param noteId id of note
 * @returns Note
 */
export function useNoteVersion(
  noteId?: string,
  versionIndex?: number,
): UseQueryResult<Note, Error> {
  return useQuery({
    queryKey: ["versions", noteId, versionIndex],

    queryFn: () => {
      if (!noteId || !versionIndex) {
        throw new Error("noteId and versionIndex required");
      }
      return noteApi.getVersion(noteId, versionIndex);
    },

    enabled: !!noteId,

    select: (data) => new Note({ ...data } as NoteData),
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      title,
      content,
    }: {
      noteId: string;
      title?: string;
      content?: string;
    }) => noteApi.patch(noteId, title, content),

    /**
     * refresh detail cache instantly
     */
    onSuccess: (updatedNote) => {
      queryClient.setQueryData(["notes", updatedNote.id], updatedNote);

      // Refresh notes lists and searches
      queryClient.invalidateQueries({
        queryKey: ["notes"],
      });

      // acitivties
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.refetchQueries({
        queryKey: ["activity", "note", updatedNote.id],
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
    mutationFn: ({ title, content }: { title: string; content: string }) =>
      noteApi.post(title, content),

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
