import { create } from "zustand";

// ---------------------------------------------------------------------------
// useNoteFindStore
// Tiny bridge between the floating FindReplaceBar and the source-mode
// NoteSourceEditor. The source surface is a plain auto-growing
// textarea, which cannot render match highlights on its own, so the
// bar publishes the resolved source matches here and the source editor
// paints them in a mirrored overlay.
// ---------------------------------------------------------------------------

export interface SourceFindMatch {
  from: number;
  to: number;
}

interface NoteFindState {
  /** Matches in the current source markdown, in document order. */
  matches: SourceFindMatch[];
  /** Index of the active match, or -1 when there is none. */
  activeIndex: number;
  setHighlight: (matches: SourceFindMatch[], activeIndex: number) => void;
  clearHighlight: () => void;
}

export const useNoteFindStore = create<NoteFindState>((set) => ({
  matches: [],
  activeIndex: -1,
  setHighlight: (matches, activeIndex) => set({ matches, activeIndex }),
  clearHighlight: () => set({ matches: [], activeIndex: -1 }),
}));
