import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAttachmentApi } from "../AttachmentApi";
import type {
  AttachmentMetadata,
  UpdateAttachmentRequest,
} from "../models/attachment";
import type { MinimalNote } from "../models/search";
import { useAuthStore } from "../../zustand/useAuthStore";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const attachmentApi = getAttachmentApi();

/**
 * Shape of the per-note attachment cache (`["attachments", noteId]`).
 *
 * The array may contain `null` entries - `byNote`'s `queryFn` pushes
 * the result of `getAttachmentMetadata` as-is, and that API returns
 * `null` on non-ok responses (e.g. a public share that doesn't grant
 * access to every attachment on the note). Every consumer of this
 * cache key must tolerate `null` entries; the cache is NOT guaranteed
 * to be a pure `AttachmentMetadata[]`.
 */
export type AttachmentMetadataList = (AttachmentMetadata | null)[];

export const attachmentQueries = {
  byNote: (noteId: string, attachmentKeys: string[]) => ({
    queryKey: ["attachments", noteId],
    queryFn: async (): Promise<AttachmentMetadataList> => {
      const metadatas: AttachmentMetadataList = [];
      for (const key of attachmentKeys) {
        try {
          const metadata = await attachmentApi.getAttachmentMetadata(key);
          metadatas.push(metadata);
        } catch (error) {
          console.error(
            `Failed to fetch metadata for attachment ${key}:`,
            error,
          );
        }
      }
      return metadatas;
    },
  }),

  /**
   * Fetch a fresh per-attachment JWT for a key that wasn't in the
   * initial note token map. Keyed independently of the metadata queries
   * so a late-joining collaborator's upload doesn't invalidate the
   * whole per-note array.
   */
  token: (key: string) => ({
    queryKey: ["attachments", "token", key],
    queryFn: (): Promise<string | null> =>
      attachmentApi.getAttachmentToken(key),
  }),
};

/**
 * Custom hook to fetch attachments for a given note
 * @usage ```
 * const {data: attachments} = useAttachments(note.id, note.attachment_ids);
 * ```
 * @param noteId
 * @param attachmentKeys
 * @returns
 */
//
export function useAttachments(
  noteId: string,
  attachmentKeys: string[],
  enabled: boolean = true,
) {
  return useQuery({
    ...attachmentQueries.byNote(noteId, attachmentKeys),
    enabled: enabled,
  });
}

/**
 * Resolve a per-attachment JWT for a key the note's initial token map
 * doesn't cover, then merge it into `useAuthStore.shareAttachmentTokens`
 * so `resolveShareAttachmentToken` (and therefore `ImageNodeView`) picks
 * it up on the next render.
 *
 * The motivating case is live collab on a public share: another
 * collaborator uploads an image, the Yjs update inserts the `<img>`
 * node, but the note token map was snapshotted at load time. Without a
 * token the public image route rejects the request and the preview
 * stays broken.
 *
 * Pass `enabled = false` (e.g. a token was already resolved, or the
 * note isn't a public share) to skip the request entirely.
 *
 * @usage ```ts
 * useShareAttachmentToken(attachmentKey, isPublic && !jwt);
 * ```
 */
export function useShareAttachmentToken(key: string, enabled: boolean) {
  const query = useQuery({
    ...attachmentQueries.token(key),
    enabled: enabled && Boolean(key),
  });

  useEffect(() => {
    if (query.data) {
      useAuthStore.getState().addShareAttachmentToken(key, query.data);
    }
  }, [query.data, key]);

  return query;
}

/**
 * patch an attachment for a given note id
 * @param noteId the note id under which to apply patches
 * @usage ```ts
 * const patchAttachment = usePatchAttachment(noteId);
 *
 *  patchAttachment.mutate({
 *   patch: {
 *     key: "abc",
 *     filename: "new file name"
 *   },
 * });
 * ```
 * @returns
 */
export function usePatchAttachment(noteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ patch }: { patch: UpdateAttachmentRequest }) =>
      attachmentApi.updateAttachment(patch),

    onSuccess: (updatedAttachment) => {
      if (!updatedAttachment) return;
      // Refresh both the per-note array and the per-key entry used by `useAttachmentMetadata`. The `?.` keeps null entries in place; the cache shape is `(AttachmentMetadata | null)[]`.
      queryClient.setQueryData<AttachmentMetadataList>(
        ["attachments", noteId],
        (old) =>
          (old ?? []).map((attachment) =>
            attachment?.key === updatedAttachment.key
              ? updatedAttachment
              : attachment,
          ),
      );
      queryClient.setQueryData(
        ["attachments", noteId, updatedAttachment.key],
        updatedAttachment,
      );
    },
  });
}

export function useDeleteAttachment(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentKey: string) =>
      attachmentApi.deleteAttachment(attachmentKey),

    onSuccess: (_, attachmentKey) => {
      // instead of invalidate the whole query, we
      // remove the deleted attachment from cache. `?.` keeps
      // null entries (cache shape is `(AttachmentMetadata | null)[]`).
      queryClient.setQueryData<AttachmentMetadataList>(
        ["attachments", noteId],
        (old) =>
          (old ?? []).filter((attachment) => attachment?.key !== attachmentKey),
      );
    },
  });
}
/**
 * @usage ```ts
 * const createAttachment = useCreateAttachment();
 * const attachment = await createAttachment.mutateAsync({file: myFile, noteId: myNoteId})
 * ```
 * @returns factory to create attachments
 */
export function useCreateAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, noteId }: { file: File; noteId: string }) =>
      attachmentApi.createAttachment(file),

    onSuccess: (createdAttachment, { noteId }) => {
      // insert attachment into cache for note
      queryClient.setQueryData(
        ["attachments", noteId],
        (old: MinimalNote[] = []) => [createdAttachment, ...old],
      );
    },
  });
}

/**
 * Look up a single attachment by key. Reads the per-note cache from
 * `useAttachments` first, falls back to a direct `getAttachmentMetadata`
 * fetch. Used by the editor's "click to preview" handlers — the
 * cache is already warm in the common case.
 *
 * @usage ```ts
 * const { data, isLoading, error } = useAttachmentMetadata(noteId, key);
 * ```
 */
export function useAttachmentMetadata(noteId: string | undefined, key: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["attachments", noteId, key],
    enabled: Boolean(noteId && key),
    staleTime: 60_000,
    initialData: () => {
      if (!noteId) return undefined;
      const cached = queryClient.getQueryData<AttachmentMetadataList>([
        "attachments",
        noteId,
      ]);
      // `cached` may contain `null` entries (bug which occured for public users accessing a share
      // because they got JWT, but attechment api returned 403 )
      return cached?.find((a) => a?.key === key);
    },
    queryFn: async () => {
      const metadata = await attachmentApi.getAttachmentMetadata(key);
      if (!metadata) {
        throw new Error(`Attachment ${key} not found`);
      }
      // Seed the per-note cache so lookups stay consistent. Skip
      // null entries
      if (noteId) {
        queryClient.setQueryData<AttachmentMetadataList>(
          ["attachments", noteId],
          (old) => {
            const existing = old ?? [];
            if (existing.some((a) => a?.key === key)) return existing;
            return [...existing, metadata];
          },
        );
      }
      return metadata;
    },
  });
}
