import { create } from "zustand";
import type {
  MinimalNote,
  Note,
  PermissionRelationshipReply,
} from "../api/models/search";

interface MainPageState {
  // bool for modal which shows popup like the note
  noteModalOpen: boolean;

  // setter for the modal which shows popup like the note
  setNoteModalOpen: (open: boolean) => void;

  // the note which will be displayed in the modal
  selectedModalNote: Note | null;

  // setter for the note which will be displayed in the modal
  setSelectedModalNote: (note: Note | null) => void;
}

export const useMainPageStore = create<MainPageState>((set) => ({
  noteModalOpen: false,
  setNoteModalOpen: (open: boolean) => set({ noteModalOpen: open }),
  selectedModalNote: null,
  setSelectedModalNote: (note: Note | null) => set({ selectedModalNote: note }),
}));
