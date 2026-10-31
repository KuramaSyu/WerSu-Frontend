import { create } from "zustand";

interface ImageResizeState {
  /**
   * When true, dragging any resize handle keeps the image's aspect
   * ratio (no stretching). Toggled from the image bubble menu.
   */
  locked: boolean;
  setLocked: (locked: boolean) => void;
  toggleLocked: () => void;
}

export const useImageResizeStore = create<ImageResizeState>((set) => ({
  locked: true,
  setLocked: (locked) => set({ locked }),
  toggleLocked: () => set((state) => ({ locked: !state.locked })),
}));
