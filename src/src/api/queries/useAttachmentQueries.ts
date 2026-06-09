import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AttachmentApi } from "../AttachmentApi";
import type {
  AttachmentMetadata,
  UpdateAttachmentRequest,
} from "../models/attachment";

const attachmentApi = new AttachmentApi();

export const attachmentQueries = {
  byNote: (noteId: string, attachmentKeys: string[]) => ({
    queryKey: ["attachments", noteId],
    queryFn: async () => {
      var metadatas = [];
      for (const key of attachmentKeys) {
        const metadata = await attachmentApi.getAttachmentMetadata(key);
        if (!metadata) {
          throw new Error("Failed to fetch attachments for note " + noteId);
        }
        metadatas.push(metadata);
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
export function useAttachments(noteId: string, attachmentKeys: string[]) {
  return useQuery(attachmentQueries.byNote(noteId, attachmentKeys));
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
