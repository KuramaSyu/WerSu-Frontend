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
import {
  ensureSyncedBlur,
  SYNCED_THEME_IMAGE_WIDTH_DESKTOP,
  SYNCED_THEME_IMAGE_WIDTH_MOBILE,
  withSyncedImageWidth,
} from "../utils/syncedThemeImages";
import { useBreakpoint } from "./useBreakpoint";

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

/** Progress report emitted while publishing custom themes. */
export interface CustomThemesPublishProgress {
  /** Steps finished so far. */
  completed: number;
  /** Total steps: image uploads plus the preference write. */
  total: number;
  /** Human-readable current phase. */
  message: string;
}

/** Callback receiving publish progress updates. */
export type CustomThemesProgressCallback = (
  progress: CustomThemesPublishProgress,
) => void;

/**
 * Count the distinct `local:` backgrounds that publishing these records will
 * upload. Used to size the progress bar before the (concurrent) uploads
 * start. The blurred variant is never uploaded (the consumer regenerates it
 * from the source + `blur`), and a dark/light pair sharing one image counts
 * once.
 */
export function countLocalThemeImages(
  themes: GeneratedThemeRecord[],
): number {
  const sources = new Set<string>();
  for (const record of themes) {
    if (record.backgroundImage.startsWith("local:")) {
      sources.add(record.backgroundImage);
    }
  }
  return sources.size;
}

/**
 * Upload a theme's local source background and return the record with its
 * remote attachment URL. Images already stored as URLs pass through
 * untouched. On upload failure the field is emptied rather than failing the
 * whole publish, so a theme without its background still syncs its colors.
 *
 * The blurred variant is intentionally dropped: consumers re-render it from
 * the source image plus the persisted `blur` amount. `uploads` is shared
 * across the whole publish so a dark/light pair using the same source blob
 * uploads it once. `onImageUploaded` fires once per *distinct* upload,
 * whether it succeeded or not, so callers can advance a progress counter.
 */
async function materializeThemeImages(
  record: GeneratedThemeRecord,
  owner: CustomThemesOwner,
  uploads: Map<string, Promise<string>>,
  onImageUploaded?: () => void,
): Promise<GeneratedThemeRecord> {
  const cache = useImageBlobCacheStore.getState();

  const upload = (source: string, filename: string): Promise<string> => {
    // Only device-local blobs need uploading; empty / remote URLs stay.
    if (source.length === 0 || !source.startsWith("local:")) {
      return Promise.resolve(source);
    }
    const inflight = uploads.get(source);
    if (inflight !== undefined) {
      return inflight;
    }
    const work = (async (): Promise<string> => {
      try {
        const entry = await cache.resolve(source);
        if (entry === null) {
          return "";
        }
        const file = new File([entry.blob], filename, {
          type:
            entry.contentType.length > 0 ? entry.contentType : "image/webp",
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
      } finally {
        onImageUploaded?.();
      }
    })();
    uploads.set(source, work);
    return work;
  };

  const backgroundImage = await upload(
    record.backgroundImage,
    `${record.name}.webp`,
  );
  return { ...record, backgroundImage, blurredBackgroundImage: "" };
}

/**
 * Publish a set of generated themes (and optional active selection) to an
 * owner's `custom-themes` preference row.
 *
 * Local `local:<id>` background blobs are first uploaded as attachments and
 * linked to the owner (user or shelf), and the returned URLs are stored in
 * the payload so other clients can render the theme.
 *
 * `onProgress` receives step updates: one per image upload plus one for the
 * preference write. Progress is best-effort and never affects the result.
 */
export async function publishCustomThemes(
  owner: CustomThemesOwner,
  themes: GeneratedThemeRecord[],
  active: ThemePreference | null,
  replace: ReturnType<typeof useReplacePreferences>["mutateAsync"],
  onProgress?: CustomThemesProgressCallback,
): Promise<void> {
  const imageCount = countLocalThemeImages(themes);
  // Image uploads plus the single preference write. Callers that do more
  // after this can offset `total` (see `useCloudPreferences`).
  const total = imageCount + 1;
  let completed = 0;
  onProgress?.({
    completed,
    total,
    message:
      imageCount > 0 ? "Uploading theme images" : "Saving custom themes",
  });
  // Shared across every record so the same source blob (e.g. a dark/light
  // pair generated from one image) is uploaded once.
  const uploads = new Map<string, Promise<string>>();
  const materialized = await Promise.all(
    themes.map((record) =>
      materializeThemeImages(record, owner, uploads, () => {
        completed += 1;
        onProgress?.({
          completed,
          total,
          message: "Uploading theme images",
        });
      }),
    ),
  );
  onProgress?.({ completed, total, message: "Saving custom themes" });
  const payload = buildCustomThemesData(materialized, active);
  await replace({
    scope: owner.scope,
    target_id: owner.targetId,
    key: CUSTOM_THEMES_PREFERENCE_KEY,
    preferences_json: serializeCustomThemesData(payload),
  });
  onProgress?.({ completed: total, total, message: "Custom themes saved" });
}

/**
 * Register a source's records immediately so theme names resolve at boot,
 * then asynchronously re-render any missing blurred variants and re-register
 * once they are ready.
 *
 * Registering the sharp records first avoids a window where a synced active
 * theme cannot be resolved because its blur is still generating. Returns a
 * cleanup that cancels the pending regeneration.
 */
function registerWithGeneratedBlur(
  sourceKey: string,
  records: GeneratedThemeRecord[],
  register: (sourceKey: string, records: GeneratedThemeRecord[]) => void,
): () => void {
  register(sourceKey, records);
  let cancelled = false;
  void (async () => {
    const withBlur = await Promise.all(records.map(ensureSyncedBlur));
    if (cancelled) {
      return;
    }
    const changed = withBlur.some(
      (record, index) =>
        record.blurredBackgroundImage !==
        records[index].blurredBackgroundImage,
    );
    if (changed) {
      register(sourceKey, withBlur);
    }
  })();
  return () => {
    cancelled = true;
  };
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
  const { isMobile } = useBreakpoint();
  const imageWidth = isMobile
    ? SYNCED_THEME_IMAGE_WIDTH_MOBILE
    : SYNCED_THEME_IMAGE_WIDTH_DESKTOP;
  const widthThemes = useCallback(
    (records: GeneratedThemeRecord[]): GeneratedThemeRecord[] =>
      records.map((record) => withSyncedImageWidth(record, imageWidth)),
    [imageWidth],
  );
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
    return registerWithGeneratedBlur(
      `user:${userId}`,
      widthThemes(userQuery.data?.themes ?? []),
      registerSyncedThemes,
    );
  }, [userId, userQuery.data, registerSyncedThemes, widthThemes]);

  useEffect(() => {
    if (shelfId === null) {
      return;
    }
    return registerWithGeneratedBlur(
      `shelf:${shelfId}`,
      widthThemes(shelfQuery.data?.themes ?? []),
      registerSyncedThemes,
    );
  }, [shelfId, shelfQuery.data, registerSyncedThemes, widthThemes]);

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
