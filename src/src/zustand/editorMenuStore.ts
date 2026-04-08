import { create } from "zustand";

interface EditorMenuState {
  // True while the inline text-selection BubbleMenu is visible.
  isTextSelectionMenuOpen: boolean;
  // Setter used by menu components to publish their active visibility state.
  setTextSelectionMenuOpen: (isOpen: boolean) => void;
}

export const useEditorMenuStore = create<EditorMenuState>((set) => ({
  isTextSelectionMenuOpen: false,
  setTextSelectionMenuOpen: (isOpen) =>
    set({ isTextSelectionMenuOpen: isOpen }),
}));
