import { create } from "zustand";

/**
 * Open state for the note header-image picker.
 *
 * The picker is mounted by `NoteEditorCore`, but it can be opened from
 * two independent places: the banner's image button and the note
 * actions overflow menu in the desktop top bar. The top-bar toolbar is
 * rendered in a separate subtree (through `useTopBarStore`), so the
 * open flag lives here instead of in the editor's local state.
 */
interface HeaderImageModalState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useHeaderImageModalStore = create<HeaderImageModalState>(
  (set) => ({
    open: false,
    setOpen: (open) => set({ open }),
  }),
);