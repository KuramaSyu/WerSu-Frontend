import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { generatePublicUserName } from "../utils/publicUserName";

/**
 * Identity for anonymous (public) viewers.
 *
 * Public viewers have no Discord account, so the topbar previously
 * fell back to the literal "Guest"/"Not signed in". This store owns a
 * single randomly generated handle ("confused koala") that the viewer
 * can rename from the user menu. It is persisted to `localStorage` so
 * the handle (and the avatar colour derived from it) survives reloads,
 * and read by the editor's awareness config so the caret and the
 * topbar agree on the same name.
 */

const STORAGE_KEY = "public-user-storage";
const STORAGE_VERSION = 1;
/** Upper bound on a custom handle; keeps the menu + caret label sane. */
export const PUBLIC_USER_NAME_MAX_LENGTH = 40;

interface PublicUserState {
  /** Generated handle; renamed by the viewer from the user menu. */
  name: string;
  /** Replace the handle. Blank / whitespace-only rolls a fresh random one. */
  setName: (name: string) => void;
  /** Roll a fresh random handle. */
  regenerateName: () => void;
}

export const usePublicUserStore = create<PublicUserState>()(
  persist(
    (set) => ({
      name: generatePublicUserName(),
      setName: (name) =>
        set({
          name:
            name.trim().slice(0, PUBLIC_USER_NAME_MAX_LENGTH) ||
            generatePublicUserName(),
        }),
      regenerateName: () => set({ name: generatePublicUserName() }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: STORAGE_VERSION,
      // Persist only the handle; actions are pure helpers.
      partialize: (state) => ({ name: state.name }),
    },
  ),
);
