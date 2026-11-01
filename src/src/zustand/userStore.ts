import { create } from "zustand";
import { WersuUserImpl } from "./../components/DiscordLogin";

interface UserState {
  user: WersuUserImpl | null;
  /**
   * Set when the viewer explicitly logs out. It suppresses the
   * `useUser` query and forces the auth gate closed until a real login
   * calls `setUser(user)` again. Without this latch, clearing the
   * query cache while `useUser` is still mounted would immediately
   * refetch and re-hydrate the previous identity (avatar snapping
   * back into the top bar) whenever the session cookie is still valid
   * or the fake backend still answers.
   */
  loggedOut: boolean;
  setUser: (user: WersuUserImpl | null) => void;
  /** Explicit logout: clears the user and latches the gate closed. */
  setLoggedOut: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loggedOut: false,
  // A non-null user means a fresh login, which clears the latch.
  // `setUser(null)` (cold-start hydration failure) must NOT latch,
  // otherwise the app could never recover without a reload.
  setUser: (user: WersuUserImpl | null) =>
    set((state) =>
      user !== null
        ? { user, loggedOut: false }
        : { user: null, loggedOut: state.loggedOut },
    ),
  setLoggedOut: () => set({ user: null, loggedOut: true }),
}));

export interface UsersState {
  users: Record<string, WersuUserImpl>;
  friendsLoaded: boolean;

  /**
   * appends a user to the existing ones
   * @param user - the user to add
   * @returns
   */
  addUser: (user: WersuUserImpl) => void;

  /**
   * extends a dict of users where existing users will be overridden with new ones
   * @param users - the users to add
   * @returns
   */
  addFriends: (users: WersuUserImpl[]) => void;

  /**
   * removes a user from the dict
   * @param id - the id of the user to remove
   * @returns
   */
  removeUser: (id: string) => void;

  /**
   * sets the friendsLoaded state to true
   */
  setFriendsLoaded: () => void;
}

export const useUsersStore = create<UsersState>((set) => ({
  users: {},
  friendsLoaded: false,
  addUser: (user: WersuUserImpl) =>
    set((state) => ({
      users: { ...state.users, [user.id]: user },
    })),
  addFriends: (users: WersuUserImpl[]) =>
    set((state) => ({
      users: users.reduce<Record<string, WersuUserImpl>>(
        (acc, user) => {
          acc[user.id] = user;
          return acc;
        },
        { ...state.users },
      ),
      friendsLoaded: true,
    })),
  removeUser: (id: string) =>
    set((state) => {
      const updatedUsers = { ...state.users };
      delete updatedUsers[id];
      return { users: updatedUsers };
    }),
  setFriendsLoaded: () => set({ friendsLoaded: true }),
}));
