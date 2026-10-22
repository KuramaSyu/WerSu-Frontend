// Where the right-click menu is, and what the caller asked for.
//
// Deliberately dumb: it never decides what to render. Resolution is
// the pure function's job.

import { create } from "zustand";
import type {
  MenuPosition,
  RightClickButtonId,
  RightClickMenuRequest,
} from "../components/RightClick/types";

export type DirectoryDialogMode = "create" | "edit";

export interface DirectoryDialogPayload {
  mode: DirectoryDialogMode;
  directoryId?: string;
  parentId?: string;
}

interface RightClickMenuState {
  isOpen: boolean;
  /** Kept after close so MUI can play its exit animation. */
  position: MenuPosition;
  request: RightClickMenuRequest | null;
  /** App-wide kill switches. Membership is the only question ever asked. */
  disabledButtons: Set<RightClickButtonId>;

  openMenu: (request: RightClickMenuRequest) => void;
  closeMenu: () => void;
  repositionMenu: (position: MenuPosition) => void;
  setButtonEnabled: (id: RightClickButtonId, enabled: boolean) => void;

  // Counter bus for the shared directory dialog, mirroring editorMenuStore.
  directoryDialogRequest: number;
  directoryDialogPayload: DirectoryDialogPayload | null;
  openDirectoryDialog: (payload: DirectoryDialogPayload) => void;
  closeDirectoryDialog: () => void;
}

const INITIAL_POSITION: MenuPosition = { x: 0, y: 0 };

export const useRightClickMenuStore = create<RightClickMenuState>((set) => ({
  isOpen: false,
  position: INITIAL_POSITION,
  request: null,
  disabledButtons: new Set<RightClickButtonId>(),

  openMenu: (request) =>
    set({ isOpen: true, position: request.position, request }),

  closeMenu: () => set({ isOpen: false }),

  repositionMenu: (position) => set({ position }),

  // Replace the Set rather than mutate it, so subscribers actually re-render.
  setButtonEnabled: (id, enabled) =>
    set((s) => {
      if (s.disabledButtons.has(id) === !enabled) return s;
      const next = new Set(s.disabledButtons);
      if (enabled) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { disabledButtons: next };
    }),

  directoryDialogRequest: 0,
  directoryDialogPayload: null,
  openDirectoryDialog: (payload) =>
    set((s) => ({
      directoryDialogRequest: s.directoryDialogRequest + 1,
      directoryDialogPayload: payload,
    })),
  closeDirectoryDialog: () => set({ directoryDialogPayload: null }),
}));