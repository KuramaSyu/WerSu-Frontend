import { create } from "zustand";
import type { MinimalTag } from "../api/models/search";

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
