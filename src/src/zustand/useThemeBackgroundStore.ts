import { create } from "zustand";

/**
 * The resolved theme background currently painted by `AppBackground`.
 *
 * `AppBackground` owns the expensive image resolution/blur pipeline, so
 * surfaces that need their own copy of the backdrop (the note editor's
 * frosted card) subscribe here instead of resolving the image again.
 */
interface ThemeBackgroundState {
  resolvedUrl: string | null;
  setResolvedUrl: (url: string | null) => void;
}

export const useThemeBackgroundStore = create<ThemeBackgroundState>((set) => ({
  resolvedUrl: null,
  setResolvedUrl: (resolvedUrl) => set({ resolvedUrl }),
}));
