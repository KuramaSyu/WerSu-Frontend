import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useImageBlobCacheStore } from "./useImageBlobCache";
import { PERSIST_KEYS } from "../statics";

// URL in localStorage; blob in IndexedDB via the blob cache.
interface SelectedBackgroundImageState {
  // Active image URL. null means "no background".
  userImage: string | null;
  // Object URL of the cached blob for userImage. Session-scoped, never persisted.
  cachedObjectUrl: string | null;
  setUserImage: (url: string | null) => void;
}

// Re-run the blob-cache lookup for the currently-persisted URL.
export async function rehydrateCachedBackgroundImage(): Promise<void> {
  const state = useSelectedBackgroundImageStore.getState();
  const url = state.userImage;
  if (url === null) {
    return;
  }
  const entry = await useImageBlobCacheStore.getState().resolve(url);
  const next = entry?.objectUrl ?? null;
  if (state.cachedObjectUrl !== next) {
    if (state.cachedObjectUrl !== null) {
      URL.revokeObjectURL(state.cachedObjectUrl);
    }
    useSelectedBackgroundImageStore.setState({ cachedObjectUrl: next });
  }
}

export const useSelectedBackgroundImageStore =
  create<SelectedBackgroundImageState>()(
    persist(
      (set, get) => ({
        userImage: null,
        cachedObjectUrl: null,

        setUserImage: (url) => {
          // Revoke the prior cached object URL so the previous blob is released.
          const prior = get().cachedObjectUrl;
          if (prior !== null) {
            URL.revokeObjectURL(prior);
          }
          set({ userImage: url, cachedObjectUrl: null });
          if (url === null) {
            return;
          }
          // Async upgrade: swap the render path to the cached blob URL.
          const targetUrl = url;
          void (async () => {
            const entry = await useImageBlobCacheStore
              .getState()
              .resolve(targetUrl);
            // Drop the upgrade if the user has moved on.
            if (get().userImage !== targetUrl) {
              return;
            }
            const next = entry?.objectUrl ?? null;
            const prev = get().cachedObjectUrl;
            if (prev !== next) {
              if (prev !== null) {
                URL.revokeObjectURL(prev);
              }
              set({ cachedObjectUrl: next });
            }
          })();
        },
      }),
      {
        name: PERSIST_KEYS.selectedBackgroundImage,
        storage: createJSONStorage(() => localStorage),
        version: 2,
        // cachedObjectUrl is a session-scoped blob handle; never persist it.
        partialize: (state) => ({ userImage: state.userImage }),
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Partial<SelectedBackgroundImageState>;
          return {
            ...current,
            userImage: typeof p.userImage === "string" ? p.userImage : null,
          };
        },
      },
    ),
  );
