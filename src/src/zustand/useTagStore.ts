import { create } from "zustand";
import type { MinimalTag, NotesReply } from "../api/models/search";

interface TagState {
  tagsById: Record<string, MinimalTag>;
  upsertTags: (tags: MinimalTag[]) => void;
  upsertTag: (tag: MinimalTag) => void;
  clearTags: () => void;
}

export const useTagStore = create<TagState>((set) => ({
  tagsById: {},
  upsertTags: (tags: MinimalTag[]) =>
    set((state) => {
      const next = { ...state.tagsById };
      for (const tag of tags) {
        next[tag.id] = tag;
      }
      return { tagsById: next };
    }),
  upsertTag: (tag: MinimalTag) =>
    set((state) => ({ tagsById: { ...state.tagsById, [tag.id]: tag } })),
  clearTags: () => set({ tagsById: {} }),
}));

/**
 * Forwards the inline `tags` payload from a `NotesReply` into the
 * store. Used by note-list and note-detail query helpers so they
 * can keep the tag store in sync with replies that bundle tag rows.
 */
export const mergeTagsFromNotesReply = (reply: NotesReply): void => {
  if (reply.tags.length > 0) {
    useTagStore.getState().upsertTags(reply.tags);
  }
};
