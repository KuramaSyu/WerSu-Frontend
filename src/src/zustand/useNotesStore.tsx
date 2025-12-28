import { create } from 'zustand';
import type { MinimalNote, Note } from '../api/models/search';

interface NotesState {
  // mapping id -> Note
  notes: Record<number, Note>;
  updateNote: (note: Note) => void;
  removeNote: (id: number) => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: {},
  updateNote: (note: Note) =>
    set((state) => ({
      notes: { ...state.notes, [note.id]: note },
    })),
  removeNote: (id: number) =>
    set((state) => {
      const newNotes = { ...state.notes };
      delete newNotes[id];
      return { notes: newNotes };
    }),
}));
