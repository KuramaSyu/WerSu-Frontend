// noteStatsStore
//
// Tiny zustand bucket for live word / letter / row counts over the
// currently mounted note editor. The editor effect in
// `NoteStatsBridge.tsx` computes and pushes these on every accepted
// transaction; the metadata panel reads from here so it stays
// decoupled from the editor instance and never re-renders on the
// edit hot path directly.

import { create } from "zustand";

export interface NoteStats {
  words: number;
  letters: number;
  rows: number;
}

interface NoteStatsState {
  stats: NoteStats;
  setStats: (stats: NoteStats) => void;
  clear: () => void;
}

const EMPTY: NoteStats = { words: 0, letters: 0, rows: 0 };

/** Elementwise equality for the stats triple so unchanged content
 *  doesn't churn the panel. */
const sameStats = (a: NoteStats, b: NoteStats): boolean =>
  a.words === b.words && a.letters === b.letters && a.rows === b.rows;

export const useNoteStatsStore = create<NoteStatsState>((set) => ({
  stats: EMPTY,
  setStats: (stats) =>
    set((state) => (sameStats(state.stats, stats) ? state : { stats })),
  clear: () => set({ stats: EMPTY }),
}));
