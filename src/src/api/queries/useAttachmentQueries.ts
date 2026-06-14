import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AttachmentApi } from "../AttachmentApi";
import type {
  AttachmentMetadata,
  UpdateAttachmentRequest,
} from "../models/attachment";
import type { MinimalNote } from "../models/search";

const attachmentApi = new AttachmentApi();

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
 * const {data: attachments} = useAttachments(note.id, note.get_attachment_ids());
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
      // insert the updated attachment into cache
      queryClient.setQueryData(
        ["attachments", noteId],
        (old: AttachmentMetadata[] = []) =>
          old.map((attachment) =>
            attachment.key === updatedAttachment?.key
              ? updatedAttachment
              : attachment,
          ),
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
