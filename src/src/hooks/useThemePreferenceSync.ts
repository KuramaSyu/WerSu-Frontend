import { useEffect } from "react";

import { usePreferences } from "../api/queries/preferencesQueries";
import { parseStoredPreferences } from "../models/Preferences";
import { useThemeStore } from "../zustand/useThemeStore";
import { useUserStore } from "../zustand/userStore";

/**
 * Apply the logged-in user's cloud theme preference (`scope: "user"`) to
 * the theme store.
 *
 * This is the "preferences win" half of the device-override feature:
 * whenever the stored blob changes, the resolved theme is applied. A device
 * that has pinned its theme (`useThemeStore.themeLocked`) ignores the update
 * via `applyThemePreference`.
 *
 * Mount once near the app root. It is a no-op while no user is signed in,
 * and React Query's structural sharing means an unchanged refetch does not
 * re-trigger the effect.
 */
export function useThemePreferenceSync(): void {
  const userId = useUserStore((s) => s.user?.id ?? null);
  const applyThemePreference = useThemeStore((s) => s.applyThemePreference);
  const markThemeUserSelected = useThemeStore(
    (s) => s.markThemeUserSelected,
  );

  const { data } = usePreferences({
    scope: "user",
    target_id: userId ?? "",
  });

  useEffect(() => {
    const preferences = parseStoredPreferences(data?.preferences_json);
    if (preferences !== null) {
      // A stored user preference is an explicit choice; it must win over
      // any shelf fallback theme (see `useCustomThemesSync`).
      markThemeUserSelected();
      void applyThemePreference(preferences.theme);
    }
  }, [data, applyThemePreference, markThemeUserSelected]);
}
