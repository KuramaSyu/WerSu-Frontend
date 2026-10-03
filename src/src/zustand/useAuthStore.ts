import { create } from "zustand";

interface AuthState {
  /** Logged-in user's JWT, sent as Authorization: Bearer <token>. */
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;

  /** JWT for anonymous public-share access: the note itself and live collab if granted. */
  shareAccessToken: string | null;
  setShareAccessToken: (token: string | null) => void;

  // Mapping from attachment ID to JWT for public-share access
  shareAttachmentTokens: Record<string, string>;
  setShareAttachmentTokens: (tokens: Record<string, string>) => void;

  // Resolves a JWT and the URL-safe key for an attachment id.
  // Tries bare id, then attachments/<id>, then any suffix match.
  resolveShareAttachmentToken: (
    key: string,
  ) => { jwt: string; key: string } | undefined;

  /** Whether shareAttachmentTokens has been loaded at least once; gates ImageNodeView. */
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
    // a public share is active, so a null here is the "off" state.
    for (const listener of get().listeners) {
      listener(token);
    }
  },

  shareAttachmentTokens: {},
  setShareAttachmentTokens: (tokens: Record<string, string>) => {
    // Wholesale replacement: NoteApi.get is the source of truth and
    // writes the full map each time, so a partial-merge would leak
    // stale tokens across notes.
    // eslint-disable-next-line no-console
    console.log("[auth-store] setShareAttachmentTokens", {
      count: Object.keys(tokens).length,
      keys: Object.keys(tokens),
      // Truncate each token to 12 chars to keep the log line readable
      // while still letting us tell tokens apart.
      preview: Object.fromEntries(
        Object.entries(tokens).map(([k, v]) => [k, `${v.slice(0, 12)}...`]),
      ),
    });
    set({ shareAttachmentTokens: tokens, shareAttachmentTokensLoaded: true });
  },

  shareAttachmentTokensLoaded: false,
  resetShareAttachmentTokens: () => {
    // eslint-disable-next-line no-console
    console.log("[auth-store] resetShareAttachmentTokens (clearing map)");
    set({ shareAttachmentTokens: {}, shareAttachmentTokensLoaded: false });
  },

  resolveShareAttachmentToken: (key) => {
    const map = get().shareAttachmentTokens;
    if (map[key]) return { jwt: map[key], key };
    const prefixed = `attachments/${key}`;
    if (map[prefixed]) return { jwt: map[prefixed], key: prefixed };
    const suffix = `/${key}`;
    for (const candidate of Object.keys(map)) {
      if (candidate.endsWith(suffix)) {
        return { jwt: map[candidate], key: candidate };
      }
    }
    return undefined;
  },

  listeners: new Set(),
  addListener: (listener: TokenListener) => {
    get().listeners.add(listener);
  },
  removeListener: (listener: TokenListener) => {
    get().listeners.delete(listener);
  },
}));
