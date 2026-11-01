import { useCallback, useMemo } from "react";

import {
  usePreferences,
  useReplacePreferences,
} from "../api/queries/preferencesQueries";
import {
  PREFERENCES_VERSION,
  parseStoredPreferences,
  type PreferencesData,
  type ThemePreference,
} from "../models/Preferences";
import { useThemeStore } from "../zustand/useThemeStore";
import { useUserStore } from "../zustand/userStore";

export interface CloudPreferencesController {
  /** Preferences built from the local stores (what upload would send). */
  localData: PreferencesData;
  /** Parsed cloud blob, or `null` when absent/invalid. */
  cloudData: PreferencesData | null;
  /** True when local differs from cloud (so there is something to upload). */
  canUpload: boolean;
  /** True when the cloud blob exists and can be downloaded. */
  canDownload: boolean;
  /** True while the upload (replace) mutation is in flight. */
  isUploading: boolean;
  /** Push `localData` to the cloud, replacing the stored blob. */
  upload: () => void;
  /** Pull the cloud blob into the local stores, overriding the pin. */
  download: () => void;
}

/**
 * Bridge between the local preference stores and the cloud
 * `/api/preferences` blob (`scope: "user"`).
 *
 * Exposes the local payload, the parsed cloud payload, and manual
 * upload/download actions. Nothing is synced automatically here: theme
 * changes only reach the cloud when the user clicks upload. Page-load
 * download is handled separately by `useThemePreferenceSync` (which
 * honours the device pin); an explicit `download()` here always applies.
 */
export function useCloudPreferences(): CloudPreferencesController {
  const userId = useUserStore((s) => s.user?.id ?? null);

  // Subscribe to the pieces of the theme store that make up the payload.
  const themeName = useThemeStore((s) => s.themeName);
  const themeMode = useThemeStore((s) =>
    s.theme.palette.mode === "light" ? "light" : "dark",
  );
  const lastLightTheme = useThemeStore((s) => s.lastLightTheme);
  const lastDarkTheme = useThemeStore((s) => s.lastDarkTheme);
  const applyThemePreference = useThemeStore((s) => s.applyThemePreference);

  const { data } = usePreferences({
    scope: "user",
    target_id: userId ?? "",
  });
  const replace = useReplacePreferences();

  // Build the local payload. The active theme fills its own mode slot
  // when the per-mode memory is empty (first run), and per-mode memory
  // supplies the other slot.
  const localData = useMemo<PreferencesData>(() => {
    const theme: ThemePreference = {
      mode: themeMode,
      light: lastLightTheme ?? (themeMode === "light" ? themeName : null),
      dark: lastDarkTheme ?? (themeMode === "dark" ? themeName : null),
    };
    return { version: PREFERENCES_VERSION, theme };
  }, [themeMode, themeName, lastLightTheme, lastDarkTheme]);

  const cloudData = useMemo(
    () => parseStoredPreferences(data?.preferences_json),
    [data],
  );

  const canUpload =
    userId !== null &&
    (cloudData === null ||
      JSON.stringify(cloudData) !== JSON.stringify(localData));

  const upload = useCallback(() => {
    if (userId === null) {
      return;
    }
    replace.mutate({
      scope: "user",
      target_id: userId,
      // The API expects the payload as a JSON-encoded string.
      preferences_json: JSON.stringify(localData),
    });
  }, [replace, userId, localData]);

  const download = useCallback(() => {
    if (cloudData === null) {
      return;
    }
    // Explicit download overrides the device pin.
    void applyThemePreference(cloudData.theme, { force: true });
  }, [applyThemePreference, cloudData]);

  return {
    localData,
    cloudData,
    canUpload,
    canDownload: cloudData !== null,
    isUploading: replace.isPending,
    upload,
    download,
  };
}
