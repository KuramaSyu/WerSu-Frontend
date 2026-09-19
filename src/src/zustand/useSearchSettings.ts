import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { RestNotesSearchType } from "../api/models/search";

// User-pickable search-type default; "default" sentinel = no override
// (overlay uses fallback and shows no hint).
export type SearchTypeDefault = RestNotesSearchType | "default";

const NO_OVERRIDE = "default";
export const SEARCH_TYPE_NO_OVERRIDE = NO_OVERRIDE;

// Fallback mode the overlay opens with when the user hasn't picked
// a default; mirrors the in-store default in useSearchFilterStore.
export const FALLBACK_SEARCH_TYPE: RestNotesSearchType =
  RestNotesSearchType.CONTEXT;

const PICKABLE: readonly RestNotesSearchType[] = [
  RestNotesSearchType.KEYWORD,
  RestNotesSearchType.TYPO_TOLERANT,
  RestNotesSearchType.CONTEXT,
] as const;

const isValidDefault = (value: unknown): value is SearchTypeDefault =>
  value === NO_OVERRIDE ||
  (typeof value === "string" &&
    (PICKABLE as readonly string[]).includes(value));

// Sticky preferences for the global search overlay, persisted to
// localStorage so the choice survives reloads.
interface SearchSettingsState {
  defaultSearchType: SearchTypeDefault;
  setDefaultSearchType: (t: SearchTypeDefault) => void;
}

export const useSearchSettings = create<SearchSettingsState>()(
  persist(
    (set) => ({
      defaultSearchType: NO_OVERRIDE,
      setDefaultSearchType: (t) => set({ defaultSearchType: t }),
    }),
    {
      name: "search-settings-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ defaultSearchType: state.defaultSearchType }),
      merge: (persisted, current) => {
        // Defensive: an old/foreign shape must not crash the store.
        const p = (persisted ?? {}) as Partial<SearchSettingsState>;
        return {
          ...current,
          defaultSearchType: isValidDefault(p.defaultSearchType)
            ? p.defaultSearchType
            : current.defaultSearchType,
        };
      },
    },
  ),
);