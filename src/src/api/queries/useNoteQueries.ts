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
import { getSearchNotesApi, type ISearchNotesApi } from "../SearchNotesApi";
import {
  Note,
  RestNotesSearchType,
  type MinimalNote,
  type NoteData,
  type NotesReply,
} from "../models/search";
import { getNoteApi, type INoteApi } from "../NoteApi";
import { updateNoteParentDirectory } from "../../utils/updateNoteParentDirectory";
import { useTagStore } from "../../zustand/useTagStore";
import { WersuUserImpl } from "../../components/DiscordLogin";
import { useUserKey } from "./useUser";

export interface UpdateNoteVariables {
  noteId: string;
  title?: string;
  content?: string;
  directory_ids?: string[];
  tag_ids?: string[];
}

export interface CreateNoteVariables {
  title: string;
  content: string;
  /** Forwarded as shelf_id on POST /api/notes. */
  shelf_id?: string;
  /** Forwarded as directory_ids on POST /api/notes. */
  directory_ids?: string[];
}

// Use the registered singletons so the share-token provider installed on
// `Bootstrap` reaches these instances (a fresh `new NoteApi()` would not
// receive the provider). `getNoteApi()` throws if not registered — that's
// intentional: silent `undefined` here would cause "why is my fetch missing
// the auth header" bugs that are painful to track down.
const searchNotesApi: ISearchNotesApi = getSearchNotesApi();
const noteApi: INoteApi = getNoteApi();

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

export const noteQueries = {
  /**
   * Default list shown in main screen with the latest 50 entries.
   *
   * Returns a `NotesReply` (notes + referenced tags) so the tag store
   * stays in sync.
   */
  list: (userKey: string | null) => ({
    queryKey: ["notes", userKey],

    queryFn: async (): Promise<NotesReply> =>
      mergeNotesReplyIntoStores(
        await searchNotesApi.search(RestNotesSearchType.LATEST, "", {
          limit: 50,
          offset: 0,
        }),
      ),
  }),

  /**
   * Search notes. Returns the full `NotesReply` so callers can show
   * tag labels without an extra fetch.
   *
   * The `queryKey` mirrors `useInfiniteNoteSearch`'s cache key
   * (searchType + query) so callers can pin either one without the
   * two query stores drifting apart.
   */
  search: (
    userKey: string | null,
    searchType: RestNotesSearchType,
    query: string,
    limit: number,
    offset: number,
  ) => ({
    queryKey: ["notes", "search", searchType, query, userKey],

    queryFn: async (): Promise<NotesReply> =>
      mergeNotesReplyIntoStores(
        await searchNotesApi.search(searchType, query, { limit, offset }),
      ),
  }),

  /**
   * Full note details with permissions and full content
   * @returns Note
   */
  detail: (userKey: string | null, noteId: string) => ({
    queryKey: ["notes", noteId, userKey],

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
  const userKey = useUserKey();
  return useQuery({
    ...noteQueries.list(userKey),
    select: (reply: NotesReply | undefined) => reply?.notes ?? [],
  });
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
  const userKey = useUserKey();
  return useInfiniteQuery({
    queryKey: ["notes", "search", searchType, query, userKey],

    /**
     * pageParam is our offset.
     * First page starts with offset=0
     */
    queryFn: ({ pageParam = 0 }) =>
      noteQueries
        .search(userKey, searchType, query, limit, pageParam)
        .queryFn(),

    /**
     * Determines pageParam = offset for the next call. We use the note
     * count of the last page (the directory / tag fan-out is a constant
     * multiplier that doesn't pin pagination).
     *
     * The `lastPageNotes` helper also tolerates the pre-migration
     * `MinimalNote[]` shape so a stale persisted page that slipped past
     * the cache buster can't crash the hook with `lastPage.notes is
     * undefined`.
     */
    getNextPageParam: (lastPage, allPages) => {
      const lastPageNotes = Array.isArray(lastPage)
        ? (lastPage as unknown as MinimalNote[])
        : (lastPage?.notes ?? []);
      if (lastPageNotes.length < limit) {
        return undefined;
      }
      return allPages.length * limit;
    },

    // No `select` here on purpose: callers flatten `data.pages` inside a
    // useMemo so the resulting array only changes when a new page
    // actually arrives, not on every TanStack status tick.

    initialPageParam: 0,
    enabled,
  });
}

/**
 * get a note with all details
 * @param noteId id of note
 * @returns Note
 */
export function useNote(noteId?: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: ["notes", noteId, userKey],

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
  const userKey = useUserKey();
  return useQuery({
    queryKey: ["versions", noteId, versionIndex, userKey],

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
  const userKey = useUserKey();

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
      queryClient.setQueryData(["notes", updatedNote.id, userKey], updatedNote);

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
 * const note = await createNote.mutateAsync({
 *   title: "hunter x hunter",
 *   content: "one of the best animes",
 *   // at least one of shelf_id / directory_ids is required by the backend:
 *   shelf_id: "shelf-1",
 *   // or: directory_ids: ["dir-1", "dir-2"],
 * })
 * ```
 * @returns factory to create notes
 */
export function useCreateNote() {
  const queryClient = useQueryClient();
  const userKey = useUserKey();

  return useMutation({
    mutationFn: ({
      title,
      content,
      shelf_id,
      directory_ids,
    }: CreateNoteVariables) =>
      noteApi.post(title, content, { shelf_id, directory_ids }),

    onSuccess: (createdNote) => {
      // update "notes" e.g. latest 50
      queryClient.setQueryData<NotesReply | undefined>(
        ["notes", userKey],
        (old) =>
          old
            ? {
                ...old,
                notes: [createdNote, ...old.notes],
              }
            : old,
      );

      queryClient.setQueryData(["notes", createdNote.id, userKey], createdNote);

      // Update the detail cache
      queryClient.setQueryData(["notes", createdNote.id, userKey], createdNote);

      // Refresh activity lists so the new note appears immediately
      queryClient.invalidateQueries({
        queryKey: ["activity"],
      });
    },
  });
}

/**
 * deletes a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();
  const userKey = useUserKey();

  return useMutation({
    mutationFn: (noteId: string) => noteApi.delete(noteId),

    // when calling .mutate, noteId is the parameter passed into mutate
    onSuccess: (_, noteId) => {
      // remove detail cache
      queryClient.removeQueries({
        queryKey: ["notes", noteId, userKey],
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
  const userKey = useUserKey();

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
        queryKey: ["notes", noteId, userKey],
      });

      // refresh all lists/searches
      queryClient.invalidateQueries({
        queryKey: ["notes"],
      });
    },

    // patch the note permissions and update it
    onMutate: async ({ noteId, directoryId }) => {
      await queryClient.cancelQueries({
        queryKey: ["notes", noteId, userKey],
      });

      const previous = queryClient.getQueryData<Note>([
        "notes",
        noteId,
        userKey,
      ]);
      const previousParentId = previous?.directory_ids?.[0];
      queryClient.setQueryData(
        ["notes", noteId, userKey],
        (note: Note | undefined) => {
          if (!note) {
            return note;
          }

          return updateNoteParentDirectory(note, directoryId);
        },
      );

      return { previousParentId };
    },

    onSettled: (_, __, variables, context) => {
      // get valid and used directories
      const directoryIds: string[] = [];
      for (const directoryId of [
        context?.previousParentId,
        variables.directoryId,
      ]) {
        if (!directoryId) continue;

        if (directoryIds.includes(directoryId)) {
          continue;
        }
        directoryIds.push(directoryId);
      }

      // invalidate their cache
      for (const directoryId of directoryIds) {
        queryClient.removeQueries({
          queryKey: ["directory", "notes", directoryId, userKey],
        });
      }

      // invalidate default view
      queryClient.invalidateQueries({
        queryKey: ["notes", userKey],
        exact: true,
      });

      // invalidate searches
      queryClient.invalidateQueries({
        queryKey: ["notes", "search"],
      });
    },
  });
}
