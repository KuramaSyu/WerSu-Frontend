import { create } from "zustand";
import type { DirectoryReply } from "../api/models/directory";
import type { AttachmentMetadata } from "../api/models/attachment";
import { AttachmentApi } from "../api/AttachmentApi";

interface AttachmentState {
  // Mapping directory ID -> Directory instance.
  attachmentsById: Record<string, AttachmentMetadata[]>;

  // sets (overrides) attachments for a note
  setAttachments: (note_id: string, attachments: AttachmentMetadata[]) => void;

  // updates attachments for a note. Duplicate attachments will be overridden by the new ones
  upsertAttachments: (
    note_id: string,
    attachments: AttachmentMetadata[],
  ) => void;

  // remove attachments for a note
  removeAttachments: (note_id: string) => void;

  // clears all attachments in the store
  clearDirectories: () => void;
}

export const useAttachmentStore = create<AttachmentState>((set) => ({
  attachmentsById: {},
  setAttachments: (note_id: string, attachments: AttachmentMetadata[]) =>
    set((state) => ({
      attachmentsById: {
        ...state.attachmentsById,
        [note_id]: attachments,
      },
    })),
  upsertAttachments: (note_id: string, attachments: AttachmentMetadata[]) =>
    set((state) => {
      const existingAttachments = state.attachmentsById[note_id] || [];
      const attachmentsByKey: Record<string, AttachmentMetadata> = {};
      for (const attachment of [...existingAttachments, ...attachments]) {
        attachmentsByKey[attachment.key] = attachment;
      }
      return {
        attachmentsById: {
          ...state.attachmentsById,
          [note_id]: Object.values(attachmentsByKey),
        },
      };
    }),
  removeAttachments: (note_id: string) =>
    set((state) => {
      const attachmentsById = { ...state.attachmentsById };
      delete attachmentsById[note_id];
      return { attachmentsById };
    }),
  clearDirectories: () => set({ attachmentsById: {} }),
}));
