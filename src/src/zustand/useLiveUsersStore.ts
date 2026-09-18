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

// True when two LiveUser arrays have the same userIds in the same
// order with the same colors. Used by `setUsers` to drop no-op
// awareness ticks before they reach subscribers.
const sameLiveUsers = (a: LiveUser[], b: LiveUser[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].userId !== b[i].userId || a[i].color !== b[i].color) {
      return false;
    }
  }
  return true;
};

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
    // Drop no-op updates: y-protocols fires `awareness.on('change')`
    // on every local cursor move and selection change, so without
    // this check `setUsers` allocates a fresh array ref per tick and
    // re-renders every consumer (VersionInfo, CollabStatusBadge).
    setUsers: (noteId, users) =>
      set((state) => {
        const existing = state.usersByNoteId[noteId];
        if (existing && sameLiveUsers(existing, users)) {
          return state;
        }
        return {
          usersByNoteId: { ...state.usersByNoteId, [noteId]: users },
        };
      }),
    clearUsers: (noteId) =>
      set((state) => {
        const existing = state.usersByNoteId[noteId];
        if (existing && existing.length === 0) {
          return state;
        }
        return {
          usersByNoteId: { ...state.usersByNoteId, [noteId]: [] },
        };
      }),
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
