import { create } from "zustand";

interface SettingsNavState {
  /**
   * id of the category whose section is currently in view.
   * The Settings page's `IntersectionObserver` writes it as the user
   * scrolls; the left rail reads it to highlight the row.
   */
  activeCategoryId: string | null;
  setActiveCategoryId: (id: string | null) => void;
}

/**
 * Tiny shared store for the active-section id on the Settings page.
 *
 * Lives in its own store (not a prop) because the left rail is
 * mounted via `useLeftPanel()` and the main content is mounted as the
 * route element: they're siblings in the layout tree, not parent and
 * child, so lifting state through props would force one of them to
 * own the state via a ref + force-render dance.
 */
export const useSettingsNavStore = create<SettingsNavState>((set) => ({
  activeCategoryId: null,
  setActiveCategoryId: (id) => set({ activeCategoryId: id }),
}));
