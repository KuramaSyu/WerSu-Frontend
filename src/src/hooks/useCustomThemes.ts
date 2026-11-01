import { useCallback, useEffect, useMemo } from "react";

import { getAttachmentApi } from "../api/AttachmentApi";
import {
  usePreferences,
  useReplacePreferences,
} from "../api/queries/preferencesQueries";
import {
  buildCustomThemesData,
  CUSTOM_THEMES_PREFERENCE_KEY,
  parseCustomThemesData,
  serializeCustomThemesData,
  type CustomThemeScope,
  type CustomThemesData,
} from "../models/customThemes";
import type { ThemePreference } from "../models/Preferences";
import type { GeneratedThemeRecord } from "../theme/imageTheme";
import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import { useSelectedShelfStore } from "../zustand/useSelectedShelfStore";
import { useThemeStore } from "../zustand/useThemeStore";
import { useUserStore } from "../zustand/userStore";

const attachmentApi = getAttachmentApi();

/** Owner row a custom-themes payload is stored under. */
export interface CustomThemesOwner {
  scope: CustomThemeScope;
  targetId: string;
}

/** Read the `custom-themes` blob for an owner; `null` when absent/invalid. */
export function useCustomThemesPreference(
  owner: CustomThemesOwner,
): {
  data: CustomThemesData | null;
  isLoading: boolean;
} {
  const { data, isLoading } = usePreferences({
    scope: owner.scope,
    target_id: owner.targetId,
    key: CUSTOM_THEMES_PREFERENCE_KEY,
  });
  const parsed = useMemo(
    () => parseCustomThemesData(data?.preferences_json),
    [data],
  );
  return { data: parsed, isLoading };
}

/**
 * Upload a theme's local image/panel background and return the record with
 * remote attachment URLs. Images already stored as URLs pass through
 * untouched. On upload failure the field is emptied rather than failing the
 * whole publish, so a theme without its background still syncs its colors.
 */
async function materializeThemeImages(
  record: GeneratedThemeRecord,
  owner: CustomThemesOwner,
): Promise<GeneratedThemeRecord> {
  const cache = useImageBlobCacheStore.getState();

  const upload = async (
    source: string,
    filename: string,
  ): Promise<string> => {
    // Only device-local blobs need uploading; empty / remote URLs stay.
    if (source.length === 0 || !source.startsWith("local:")) {
      return source;
    }
    const entry = await cache.resolve(source);
    if (entry === null) {
      return "";
    }
    const file = new File([entry.blob], filename, {
      type: entry.contentType.length > 0 ? entry.contentType : "image/webp",
    });
    const created = await attachmentApi.createAttachment(file);
    if (created === null) {
      return "";
    }
    const url = await attachmentApi.linkAttachment({
      attachment_key: created.key,
      link_to: owner.scope,
      ...(owner.scope === "user"
        ? { user_id: owner.targetId }
        : { shelf_id: owner.targetId }),
    });
    return url ?? "";
  };

  const backgroundImage = await upload(
    record.backgroundImage,
    `${record.name}.webp`,
  );
  const blurredBackgroundImage = await upload(
    record.blurredBackgroundImage,
    `${record.name}-blur.webp`,
  );
  return { ...record, backgroundImage, blurredBackgroundImage };
}

/**
 * Publish a set of generated themes (and optional active selection) to an
 * owner's `custom-themes` preference row.
 *
 * Local `local:<id>` background blobs are first uploaded as attachments and
 * linked to the owner (user or shelf), and the returned URLs are stored in
 * the payload so other clients can render the theme.
 */
export async function publishCustomThemes(
  owner: CustomThemesOwner,
  themes: GeneratedThemeRecord[],
  active: ThemePreference | null,
  replace: ReturnType<typeof useReplacePreferences>["mutateAsync"],
): Promise<void> {
  const materialized = await Promise.all(
    themes.map((record) => materializeThemeImages(record, owner)),
  );
  const payload = buildCustomThemesData(materialized, active);
  await replace({
    scope: owner.scope,
    target_id: owner.targetId,
    key: CUSTOM_THEMES_PREFERENCE_KEY,
    preferences_json: serializeCustomThemesData(payload),
  });
}

/**
 * Register the signed-in user's and the active shelf's custom themes with
 * the theme store, and apply the shelf's active theme when the user has not
 * selected a theme of their own.
 *
 * Mount once near the app root (next to `useThemePreferenceSync`).
 */
export function useCustomThemesSync(): void {
  const userId = useUserStore((s) => s.user?.id ?? null);
  const shelfId = useSelectedShelfStore((s) => s.selectedShelfId);
  const registerSyncedThemes = useThemeStore((s) => s.registerSyncedThemes);
  const themeUserSelected = useThemeStore((s) => s.themeUserSelected);
  const themeLocked = useThemeStore((s) => s.themeLocked);
  const applyThemePreference = useThemeStore((s) => s.applyThemePreference);

  const userQuery = useCustomThemesPreference({
    scope: "user",
    targetId: userId ?? "",
  });
  const shelfQuery = useCustomThemesPreference({
    scope: "shelf",
    targetId: shelfId ?? "",
  });

  useEffect(() => {
    if (userId === null) {
      return;
    }
    registerSyncedThemes(`user:${userId}`, userQuery.data?.themes ?? []);
  }, [userId, userQuery.data, registerSyncedThemes]);

  useEffect(() => {
    if (shelfId === null) {
      return;
    }
    registerSyncedThemes(`shelf:${shelfId}`, shelfQuery.data?.themes ?? []);
  }, [shelfId, shelfQuery.data, registerSyncedThemes]);

  // Shelf fallback: only when the user has neither picked a theme nor
  // pinned the device. Picking a theme flips `themeUserSelected`.
  useEffect(() => {
    const active = shelfQuery.data?.active;
    if (active == null || themeUserSelected || themeLocked) {
      return;
    }
    void applyThemePreference(active);
  }, [
    shelfQuery.data,
    themeUserSelected,
    themeLocked,
    applyThemePreference,
  ]);
}

/**
 * Controller that publishes the current device's generated themes to an
 * owner and returns the local records that belong to that owner.
 */
export function usePublishCustomThemes(): {
  publish: (
    owner: CustomThemesOwner,
    themes: GeneratedThemeRecord[],
    active?: ThemePreference | null,
  ) => Promise<void>;
  isPublishing: boolean;
} {
  const replace = useReplacePreferences();
  const publish = useCallback(
    (
      owner: CustomThemesOwner,
      themes: GeneratedThemeRecord[],
      active: ThemePreference | null = null,
    ) =>
      publishCustomThemes(owner, themes, active, replace.mutateAsync),
    [replace.mutateAsync],
  );
  return { publish, isPublishing: replace.isPending };
}
