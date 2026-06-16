import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
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
  listeners: new Set(),
  addListener: (listener: TokenListener) => {
    get().listeners.add(listener);
  },
  removeListener: (listener: TokenListener) => {
    get().listeners.delete(listener);
  },
}));
