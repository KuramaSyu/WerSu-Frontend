import { create } from 'zustand';
import type { MinimalNote } from '../api/SearchNotesApi';

interface SearchNotesState {
  notes: MinimalNote[];
  setNotes: (notes: MinimalNote[]) => void;
}

export const useNotesStore = create<SearchNotesState>((set) => ({
  notes: [],
  setNotes: (notes: MinimalNote[]) => set({ notes: notes }),
}));
