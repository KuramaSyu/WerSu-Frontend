import { create } from "zustand";
import type { ComponentType } from "react";

/**
 * One registered plug-in for the desktop top bar.
 *
 * Slots are ordered (ascending `order` renders leftward) so callers
 * don't have to coordinate their left/right placement via string
 * munging -- each one picks an integer and the top bar sorts.
 *
 * `Component` is a reference, not a rendered element, so the slot
 * re-mounts with fresh local state each time the top bar shows it.
 * That keeps UI state (e.g. an open overflow menu) scoped to the
 * visible instance and avoids cross-instance glitches when only one
 * copy is on screen at a time.
 */
export interface TopBarSlot {
  /**
   * Stable id under which the contributor registered. Carried on
   * the entry so the top bar can `key` the rendered node and React
   * can reconcile across re-orderings.
   */
  id: string;
  /**
   * Display order. Lower numbers render leftward; equal numbers keep
   * insertion order. The top bar sorts once per render.
   */
  order: number;
  /**
   * Component reference to mount in the slot. Receives no props; the
   * component is expected to pull everything it needs from stores.
   */
  Component: ComponentType;
}

/**
 * Snapshot of `useTopBarStore` slots, keyed by stable id. The id is
 * the contract between the caller (`setSlot(id, ...)`) and the top
 * bar's renderer (`Object.values(slots)`), so it must be unique per
 * contributor and stable across re-renders.
 */
export type TopBarSlots = Record<string, TopBarSlot>;

interface TopBarState {
  slots: TopBarSlots;
  /**
   * Register or update a slot. Pass `Component: null` (or call
   * `removeSlot(id)`) to clear. Order defaults to 0; tweak to slot
   * the contributor between siblings.
   *
   * Typical usage from a contributor component:
   *
   *     useEffect(() => {
   *       setSlot("noteActions", NoteActionsToolbar, 100);
   *       return () => removeSlot("noteActions");
   *     }, []);
   *
   * Pass an `order` that picks a left/right position relative to the
   * other top-bar items in `useTopBarStore.getState().slots`.
   */
  setSlot: (
    id: string,
    Component: ComponentType | null,
    order?: number,
  ) => void;
  /**
   * Drop a slot by id. Idempotent: a missing id is a no-op rather
   * than an error, so cleanup effects don't need to check first.
   */
  removeSlot: (id: string) => void;
}

/**
 * Slot registry consumed by `DesktopTopBar`.
 *
 * Routes that own a right rail register an "actions" component here
 * on mount; when the rail is collapsed the top bar takes over and
 * renders the same buttons so the user never loses the affordance.
 * The contract is: any component that wants to inject UI into the
 * top bar calls `setSlot` with a stable id and clears it on unmount.
 */
export const useTopBarStore = create<TopBarState>((set) => ({
  slots: {},
  setSlot: (id, Component, order = 0) =>
    set((state) => {
      if (Component === null) {
        if (!(id in state.slots)) return state;
        const next = { ...state.slots };
        delete next[id];
        return { slots: next };
      }
      return {
        slots: {
          ...state.slots,
          [id]: { id, order, Component },
        },
      };
    }),
  removeSlot: (id) =>
    set((state) => {
      if (!(id in state.slots)) return state;
      const next = { ...state.slots };
      delete next[id];
      return { slots: next };
    }),
}));

/**
 * Read the slots sorted by ascending `order`. Stable across renders;
 * pure helper for the top bar so it doesn't re-implement the sort on
 * every render.
 */
export const selectSortedTopBarSlots = (slots: TopBarSlots): TopBarSlot[] =>
  Object.values(slots).sort((left, right) => left.order - right.order);
