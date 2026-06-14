import { create } from "zustand";
import type {
  MinimalNote,
  PermissionRelationshipReply,
} from "../api/models/search";

interface SearchNotesState {
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
  isUsingKeyboard: boolean;
  setIsUsingKeyboard: (usingKeyboard: boolean) => void;
}

export const useSearchNotesStore = create<SearchNotesState>((set) => ({
  isDialogOpen: false,
  setIsDialogOpen: (open: boolean) => set({ isDialogOpen: open }),
  isSearching: false,
  setIsSearching: (searching: boolean) => set({ isSearching: searching }),
  isUsingKeyboard: false,
  setIsUsingKeyboard: (usingKeyboard: boolean) =>
    set({ isUsingKeyboard: usingKeyboard }),
}));
