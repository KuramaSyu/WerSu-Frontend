import { create } from 'zustand';
import type { MinimalNote } from '../api/models/search';

interface SearchNotesState {
  notes: MinimalNote[];
  setNotes: (notes: MinimalNote[]) => void;
}

export const useSearchNotesStore = create<SearchNotesState>((set) => ({
  notes: [],
  setNotes: (notes: MinimalNote[]) => set({ notes: notes }),
}));
