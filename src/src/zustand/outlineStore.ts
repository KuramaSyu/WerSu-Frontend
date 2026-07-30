import { create } from "zustand";

/**
 * One heading entry as the outline panel needs it.
 *
 * `id` is the slug stamped onto the heading's DOM node and used in
 * the URL as `?section=<id>` — so click-to-scroll, deep-link, and
 * `document.getElementById` lookups all share one identifier.
 */
export interface OutlineItem {
  id: string;
  level: number;
  textContent: string;
}

interface OutlineState {
  items: OutlineItem[];
  setItems: (items: OutlineItem[]) => void;
  clear: () => void;
}

/**
 * Holds the current editor's outline so the outline panel (which lives
 * in the route component, NOT inside the editor) can render the list
 * without re-rendering on every ProseMirror transaction.
 */
export const useOutlineStore = create<OutlineState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  clear: () => set({ items: [] }),
}));

interface ScrollElementState {
  element: HTMLElement | null;
  setElement: (element: HTMLElement | null) => void;
}

/**
 * The single scrolling container for the main editor column lives in
 * `AppShell`. It's mirrored here so deep-link handlers and the
 * outline panel can scroll the right element without prop-drilling
 * through the route tree.
 */
export const useScrollElementStore = create<ScrollElementState>((set) => ({
  element: null,
  setElement: (element) => set({ element }),
}));
