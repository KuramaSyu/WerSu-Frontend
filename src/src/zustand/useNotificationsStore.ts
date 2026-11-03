import { create } from "zustand";

/**
 * Global open/close state for the notifications panel.
 *
 * The panel is opened from the user menu (avatar) instead of a
 * dedicated bell button, so the trigger and the dialog live in
 * different trees: the menu item opens it and the always-mounted
 * `NotificationsDialog` (rendered by the AppShell) owns the
 * rendering.
 */
interface NotificationsState {
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  isDialogOpen: false,
  setIsDialogOpen: (open: boolean) => set({ isDialogOpen: open }),
}));
