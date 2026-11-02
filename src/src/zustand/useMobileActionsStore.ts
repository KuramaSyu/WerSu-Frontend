import { create } from "zustand";
import type { ReactNode } from "react";

/**
 * A single contextual action surfaced as an icon button in the
 * mobile bottom bar (e.g. the page-level "new note" FAB).
 */
export interface MobileAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

interface MobileActionsState {
  // Actions grouped by the component that registered them. A page
  // may register more than one owner (e.g. a page-level create slot
  // plus an editor slot), so the bar renders the flattened list in
  // registration order.
  actionsByOwner: Record<string, MobileAction[]>;
  setActions: (ownerId: string, actions: MobileAction[]) => void;
  clearActions: (ownerId: string) => void;
}

/**
 * Registry for actions that should live in the mobile bottom bar.
 *
 * Pages register their floating action buttons here while the
 * viewport is mobile; `MobileBottomBar` renders them as compact
 * icon buttons next to search / notifications. On desktop the
 * registry stays empty and the FABs render normally.
 */
export const useMobileActionsStore = create<MobileActionsState>((set) => ({
  actionsByOwner: {},
  setActions: (ownerId, actions) =>
    set((state) => ({
      actionsByOwner: { ...state.actionsByOwner, [ownerId]: actions },
    })),
  clearActions: (ownerId) =>
    set((state) => {
      if (!(ownerId in state.actionsByOwner)) {
        return state;
      }
      const next = { ...state.actionsByOwner };
      delete next[ownerId];
      return { actionsByOwner: next };
    }),
}));
