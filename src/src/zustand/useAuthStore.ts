import { create } from "zustand";

interface AuthState {
  /** Logged-in user's JWT, sent as `Authorization: Bearer <token>`. */
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;

  /**
   * JWT for anonymous public-share access.
   *
   * Populated when a non-logged-in user opens a share link. Sent as
   * `Authorization: Bearer <token>` by APIs that opt in via the
   * `ShareTokenBearer` mixin. `null` when no share is active or the user
   * is logged in (in which case the user JWT + cookies are used instead).
   */
  shareAccessToken: string | null;
  setShareAccessToken: (token: string | null) => void;

  listeners: Set<TokenListener>;
  addListener: (listener: TokenListener) => void;
  removeListener: (listener: TokenListener) => void;
}

type TokenListener = (token: string | null) => void;

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  setAccessToken: (token: string | null) => {
    set({ accessToken: token });

    // Notify all listeners about the token change
    for (const listener of get().listeners) {
      listener(token);
    }
  },

  shareAccessToken: null,
  setShareAccessToken: (token: string | null) => {
    set({ shareAccessToken: token });

    // Re-use the same listeners: the share-token case is only enabled when
    // a public share is active, so a `null` here is the "off" state.
    for (const listener of get().listeners) {
      listener(token);
    }
  },

  listeners: new Set(),
  addListener: (listener: TokenListener) => {
    get().listeners.add(listener);
  },
  removeListener: (listener: TokenListener) => {
    get().listeners.delete(listener);
  },
}));
