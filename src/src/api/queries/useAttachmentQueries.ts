import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAttachmentApi } from "../AttachmentApi";
import type {
  AttachmentMetadata,
  UpdateAttachmentRequest,
} from "../models/attachment";
import type { MinimalNote } from "../models/search";

// Use the registered singleton so the share-token provider installed on
// `Bootstrap` reaches this instance. See `useNoteQueries` for rationale.
const attachmentApi = getAttachmentApi();

export const attachmentQueries = {
  byNote: (noteId: string, attachmentKeys: string[]) => ({
    queryKey: ["attachments", noteId],
    queryFn: async () => {
      var metadatas = [];
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
      // Refresh both the per-note array and the per-key entry used by `useAttachmentMetadata`.
      queryClient.setQueryData(
        ["attachments", noteId],
        (old: AttachmentMetadata[] = []) =>
          old.map((attachment) =>
            attachment.key === updatedAttachment.key
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
      // remove the deleted attachment from cache
      queryClient.setQueryData(
        ["attachments", noteId],
        (old: AttachmentMetadata[] = []) =>
          old.filter((attachment) => attachment.key !== attachmentKey),
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
      const cached = queryClient.getQueryData<AttachmentMetadata[]>([
        "attachments",
        noteId,
      ]);
      return cached?.find((a) => a.key === key);
    },
    queryFn: async () => {
      const metadata = await attachmentApi.getAttachmentMetadata(key);
      if (!metadata) {
        throw new Error(`Attachment ${key} not found`);
      }
      // Seed the per-note cache so lookups stay consistent.
      if (noteId) {
        queryClient.setQueryData<AttachmentMetadata[]>(
          ["attachments", noteId],
          (old) => {
            const existing = old ?? [];
            if (existing.some((a) => a.key === key)) return existing;
            return [...existing, metadata];
          },
        );
      }
      return metadata;
    },
  });
}
