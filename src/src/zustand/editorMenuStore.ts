import { create } from "zustand";

interface EditorMenuState {
  // True while the inline text-selection BubbleMenu is visible.
  isTextSelectionMenuOpen: boolean;
  // Setter used by menu components to publish their active visibility state.
  setTextSelectionMenuOpen: (isOpen: boolean) => void;

  // Counter-based request channel for dialogs whose state lives in
  // NoteEditorCore. Right-rail buttons (or any other non-ancestor
  // component) bump the counter; NoteEditorCore watches the counter
  // in a useEffect and opens the matching local dialog.
  fileDialogRequest: number;
  latexDialogRequest: number;
  openFileDialog: () => void;
  openLatexDialog: () => void;
}

export const useEditorMenuStore = create<EditorMenuState>((set) => ({
  isTextSelectionMenuOpen: false,
  setTextSelectionMenuOpen: (isOpen) =>
    set({ isTextSelectionMenuOpen: isOpen }),

  fileDialogRequest: 0,
  latexDialogRequest: 0,
  openFileDialog: () =>
    set((s) => ({ fileDialogRequest: s.fileDialogRequest + 1 })),
  openLatexDialog: () =>
    set((s) => ({ latexDialogRequest: s.latexDialogRequest + 1 })),
}));
