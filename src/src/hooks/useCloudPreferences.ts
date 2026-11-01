import { useCallback, useMemo, useState } from "react";

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
import {
  countLocalThemeImages,
  publishCustomThemes,
  useCustomThemesPreference,
  type CustomThemesPublishProgress,
} from "./useCustomThemes";

export interface CloudPreferencesController {
  /** Preferences built from the local stores (what upload would send). */
  localData: PreferencesData;
  /** Parsed cloud blob, or `null` when absent/invalid. */
  cloudData: PreferencesData | null;
  /**
   * True when the active theme differs from the cloud blob or a local
   * custom theme has not been published yet (so there is something to
   * upload).
   */
  canUpload: boolean;
  /** True when the cloud blob exists and can be downloaded. */
  canDownload: boolean;
  /** True while the upload (replace) mutation is in flight. */
  isUploading: boolean;
  /**
   * Publish unsynced custom themes (images included) and push `localData`
   * to the cloud, replacing the stored default blob.
   */
  upload: () => void;
  /**
   * Step-by-step progress while uploading, or `null` when idle. Callers can
   * render it as a determinate spinner/tooltip.
   */
  progress: CustomThemesPublishProgress | null;
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
 *
 * Uploading also publishes the device's generated custom themes to the
 * keyed `custom-themes` row: their background blobs are uploaded as
 * attachments linked to the user and the returned URLs are stored so other
 * clients can render the themes. Custom themes are read back and registered
 * by `useCustomThemesSync`.
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
  // Local generated themes that belong to the signed-in user. Themes
  // explicitly published to a shelf (`scope: "shelf"`) live in that shelf's
  // row and must not leak into the personal one.
  const generatedThemes = useThemeStore((s) => s.generatedThemes);
  const localUserThemes = useMemo(
    () => generatedThemes.filter((r) => r.scope !== "shelf"),
    [generatedThemes],
  );
  const customThemesQuery = useCustomThemesPreference({
    scope: "user",
    targetId: userId ?? "",
  });
  const replace = useReplacePreferences();
  const [progress, setProgress] =
    useState<CustomThemesPublishProgress | null>(null);

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

  // A theme is already synced when its id exists in the cloud row; the
  // stored record keeps its `local:` image key, so comparing the image
  // fields would always look dirty.
  const hasUnsyncedThemes = useMemo(() => {
    const cloudIds = new Set(
      (customThemesQuery.data?.themes ?? []).map((r) => r.id),
    );
    return localUserThemes.some((r) => !cloudIds.has(r.id));
  }, [localUserThemes, customThemesQuery.data]);

  const canUpload =
    userId !== null &&
    (cloudData === null ||
      JSON.stringify(cloudData) !== JSON.stringify(localData) ||
      hasUnsyncedThemes);

  const upload = useCallback(() => {
    if (userId === null) {
      return;
    }
    void (async () => {
      try {
        // Publish custom themes first so their images are uploaded and the
        // returned URLs are stored in the keyed `custom-themes` row. Keep
        // the themes already in the cloud so a sync from a device that only
        // has *synced* themes never drops them, and only upload local records
        // that are not there yet (avoids re-uploading every image).
        const cloudCustomThemes = customThemesQuery.data;
        const byId = new Map(
          (cloudCustomThemes?.themes ?? []).map((r) => [r.id, r]),
        );
        for (const record of localUserThemes) {
          if (!byId.has(record.id)) {
            byId.set(record.id, record);
          }
        }
        const themes = [...byId.values()];
        const imageCount = countLocalThemeImages(themes);
        // One extra step for the default preference write below.
        const overallTotal = imageCount + 2;
        setProgress({
          completed: 0,
          total: overallTotal,
          message:
            imageCount > 0 ? "Uploading theme images" : "Saving theme",
        });
        await publishCustomThemes(
          { scope: "user", targetId: userId },
          themes,
          cloudCustomThemes?.active ?? null,
          replace.mutateAsync,
          (step) =>
            setProgress({
              completed: step.completed,
              total: step.total + 1,
              message: step.message,
            }),
        );
        // Then the default preference blob (active theme / per-mode memory).
        setProgress({
          completed: imageCount + 1,
          total: overallTotal,
          message: "Saving active theme",
        });
        await replace.mutateAsync({
          scope: "user",
          target_id: userId,
          // The API expects the payload as a JSON-encoded string.
          preferences_json: JSON.stringify(localData),
        });
      } catch (err) {
        // The mutation exposes the error via `replace.error`; swallow here so
        // the fire-and-forget upload does not raise an unhandled rejection.
        console.error("Failed to sync preferences to cloud:", err);
      } finally {
        setProgress(null);
      }
    })();
  }, [
    replace,
    userId,
    localData,
    localUserThemes,
    customThemesQuery.data,
  ]);

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
    // `progress` covers the image-upload phase that runs before the first
    // preference mutation, so the spinner shows for the whole operation.
    isUploading: progress !== null || replace.isPending,
    upload,
    progress,
    download,
  };
}
