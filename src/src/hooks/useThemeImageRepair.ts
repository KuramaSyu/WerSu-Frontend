import { useEffect } from "react";

import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import { useThemeStore } from "../zustand/useThemeStore";
import { repairThemeImageCache } from "../utils/syncedThemeImages";

/**
 * Heal device-local theme images after a lost or corrupted blob cache.
 *
 * Generated (and adopted) themes render from `local:` blurred blobs that
 * only exist in IndexedDB. Unlike synced themes — which `useCustomThemesSync`
 * re-renders on every boot — nothing repaired them when a write never landed
 * or the store was cleared: the background then rendered *nothing* with no
 * way back. This hook runs after the cache hydrates and, for every generated
 * theme, re-downloads a corrupt source and regenerates a missing blur.
 *
 * Synced themes are left to the sync path; repairing them here would race
 * `registerSyncedThemes`.
 */
export function useThemeImageRepair(): void {
  const generatedThemes = useThemeStore((s) => s.generatedThemes);
  const hydrated = useImageBlobCacheStore((s) => s.hydrated);
  const updateGeneratedTheme = useThemeStore((s) => s.updateGeneratedTheme);

  useEffect(() => {
    if (!hydrated || generatedThemes.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      for (const record of generatedThemes) {
        if (cancelled) {
          return;
        }
        const repaired = await repairThemeImageCache(record);
        if (cancelled) {
          return;
        }
        if (
          repaired.blurredBackgroundImage !== record.blurredBackgroundImage
        ) {
          updateGeneratedTheme(record.id, {
            blurredBackgroundImage: repaired.blurredBackgroundImage,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generatedThemes, hydrated, updateGeneratedTheme]);
}
