import { create } from "zustand";

interface AuthState {
  /** Logged-in user's JWT, sent as `Authorization: Bearer <token>`. */
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;

  /**
   * JWT for anonymous public-share access, to access the note and
   * to access the live collab if granted
   */
  shareAccessToken: string | null;
  setShareAccessToken: (token: string | null) => void;

  // Mapping from attachment ID to JWT for public-share access
  shareAttachmentTokens: Record<string, string>;
  setShareAttachmentTokens: (tokens: Record<string, string>) => void;

  /**
   * Whether the `shareAttachmentTokens` map has been loaded at least once.
   * Needed to prevent a race condition in ImageNodeView
   */
  shareAttachmentTokensLoaded: boolean;
  resetShareAttachmentTokens: () => void;

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

  shareAttachmentTokens: {},
  setShareAttachmentTokens: (tokens: Record<string, string>) => {
    // Wholesale replacement: NoteApi.get() is the source of truth and
    // writes the full map each time, so a partial-merge setter would
    // leak stale tokens across notes.
    set({ shareAttachmentTokens: tokens, shareAttachmentTokensLoaded: true });
  },

  shareAttachmentTokensLoaded: false,
  resetShareAttachmentTokens: () => {
    set({ shareAttachmentTokens: {}, shareAttachmentTokensLoaded: false });
  },

  listeners: new Set(),
  addListener: (listener: TokenListener) => {
    get().listeners.add(listener);
  },
  removeListener: (listener: TokenListener) => {
    get().listeners.delete(listener);
  },
}));
