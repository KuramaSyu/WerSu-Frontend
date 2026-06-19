import { create } from "zustand";

export interface LiveUser {
  userId: string;
  color: string;
}

// just [] caused recursion
const EMPTY_LIVE_USERS: LiveUser[] = [];

interface LiveUsersState {
  usersByNoteId: Record<string, LiveUser[]>; // noteId -> array of userIds

  extendUsers: (noteId: string, users: LiveUser[]) => void;
  setUsers: (noteId: string, users: LiveUser[]) => void;
  clearUsers: (noteId: string) => void;
}

/**
 * Represents the live users per note
 */
export const useLiveUsersStore = create<LiveUsersState>((set) => {
  return {
    usersByNoteId: {},
    extendUsers: (noteId, users) =>
      set((state) => ({
        usersByNoteId: {
          ...state.usersByNoteId,
          [noteId]: [...state.usersByNoteId[noteId], ...users],
        },
      })),
    setUsers: (noteId, users) =>
      set((state) => ({
        usersByNoteId: { ...state.usersByNoteId, [noteId]: users },
      })),
    clearUsers: (noteId) =>
      set((state) => ({
        usersByNoteId: { ...state.usersByNoteId, [noteId]: [] },
      })),
  };
});

/**
 * Custom hook which provides live users for a given noteId
 * @param noteId id of the note to get live users for
 * @returns array of live users for the given noteId
 */
export function useLiveUsers(noteId: string | undefined): LiveUser[] {
  return useLiveUsersStore((state) => {
    return noteId
      ? (state.usersByNoteId[noteId] ?? EMPTY_LIVE_USERS)
      : EMPTY_LIVE_USERS;
  });
}
