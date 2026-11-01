import { useCallback, useEffect, useMemo, useState } from "react";

import { getAttachmentApi } from "../api/AttachmentApi";
import { getPreferencesApi } from "../api/PreferencesApi";
import {
  usePreferences,
  useReplacePreferences,
} from "../api/queries/preferencesQueries";
import {
  buildCustomThemesData,
  CUSTOM_THEMES_PREFERENCE_KEY,
  parseCustomThemesData,
  removeCustomThemeGroups,
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
  cacheSyncedThemeImage,
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
  /**
   * Timestamp of the last successful read. Advances on every `refetch` even
   * when the payload is structurally unchanged, so effect deps can use it to
   * re-register after a forced re-read.
   */
  dataUpdatedAt: number;
  /** Re-read the row from the backend (e.g. after dropping a local copy). */
  refetch: () => void;
} {
  const { data, isLoading, refetch, dataUpdatedAt } = usePreferences({
    scope: owner.scope,
    target_id: owner.targetId,
    key: CUSTOM_THEMES_PREFERENCE_KEY,
  });
  const parsed = useMemo(
    () => parseCustomThemesData(data?.preferences_json),
    [data],
  );
  return {
    data: parsed,
    isLoading,
    dataUpdatedAt,
    refetch: () => {
      void refetch();
    },
  };
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
    const withBlur = await Promise.all(
      // Persist each sharp source first so the background render is a cache
      // hit, then (re)generate the blurred local variant.
      records.map(async (record) =>
        ensureSyncedBlur(await cacheSyncedThemeImage(record)),
      ),
    );
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
    // `dataUpdatedAt` changes on every successful refetch (even when React
    // Query's structural sharing keeps `data` referentially equal), so a
    // local delete followed by `refetch()` re-registers the theme.
  }, [
    userId,
    userQuery.data,
    userQuery.dataUpdatedAt,
    registerSyncedThemes,
    widthThemes,
  ]);

  useEffect(() => {
    if (shelfId === null) {
      return;
    }
    return registerWithGeneratedBlur(
      `shelf:${shelfId}`,
      widthThemes(shelfQuery.data?.themes ?? []),
      registerSyncedThemes,
    );
  }, [
    shelfId,
    shelfQuery.data,
    shelfQuery.dataUpdatedAt,
    registerSyncedThemes,
    widthThemes,
  ]);

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

/** Parse a `syncedThemeIdsBySource` key (`user:<id>` / `shelf:<id>`). */
function parseCustomThemesSourceKey(
  sourceKey: string,
): CustomThemesOwner | null {
  const separator = sourceKey.indexOf(":");
  if (separator < 0) {
    return null;
  }
  const scope = sourceKey.slice(0, separator);
  const targetId = sourceKey.slice(separator + 1);
  if ((scope !== "user" && scope !== "shelf") || targetId.length === 0) {
    return null;
  }
  return { scope, targetId };
}

/**
 * Delete custom themes from every cloud row that owns them, then drop the
 * device-local copies.
 *
 * A theme can be published to the signed-in user and/or one or more shelves.
 * `syncedThemeIdsBySource` records which preference rows contributed each
 * synced id, while locally generated records carry `scope`/`targetId` once
 * they have been published. Removing the group from those rows makes the
 * deletion reach every client on its next sync instead of only hiding the
 * theme on this device. Both variants of a dark/light pair are removed.
 */
export function useDeleteCustomThemes(): {
  /** Delete the dark/light groups containing `records` everywhere. */
  deleteThemes: (records: GeneratedThemeRecord[]) => Promise<void>;
  isDeleting: boolean;
} {
  const replace = useReplacePreferences();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteThemes = useCallback(
    async (records: GeneratedThemeRecord[]) => {
      if (records.length === 0) {
        return;
      }
      const groupIds = new Set(records.map((record) => record.groupId));
      const state = useThemeStore.getState();
      const groupRecords = [
        ...state.generatedThemes,
        ...state.syncedThemes,
      ].filter((record) => groupIds.has(record.groupId));
      // Include the caller's records too, so a deletion requested before the
      // store registers a freshly fetched row still targets the right ids.
      const allById = new Map(
        [...groupRecords, ...records].map((record) => [record.id, record]),
      );
      const allRecords = [...allById.values()];
      const ids = new Set(allRecords.map((record) => record.id));

      // Every synced source that contributed one of these ids owns a copy.
      const owners = new Map<string, CustomThemesOwner>();
      for (const [sourceKey, sourceIds] of Object.entries(
        state.syncedThemeIdsBySource,
      )) {
        if (!sourceIds.some((id) => ids.has(id))) {
          continue;
        }
        const owner = parseCustomThemesSourceKey(sourceKey);
        if (owner !== null) {
          owners.set(sourceKey, owner);
        }
      }
      // Local records remember where they were published even before the
      // corresponding row has synced back to this client.
      for (const record of allRecords) {
        if (record.scope !== undefined && record.targetId !== undefined) {
          owners.set(`${record.scope}:${record.targetId}`, {
            scope: record.scope,
            targetId: record.targetId,
          });
        }
      }

      setIsDeleting(true);
      try {
        const preferencesApi = getPreferencesApi();
        for (const owner of owners.values()) {
          const reply = await preferencesApi.getPreferences({
            scope: owner.scope,
            target_id: owner.targetId,
            key: CUSTOM_THEMES_PREFERENCE_KEY,
          });
          const data = parseCustomThemesData(reply?.preferences_json);
          if (data === null) {
            continue;
          }
          const updated = removeCustomThemeGroups(data, groupIds);
          if (updated === data) {
            continue;
          }
          await publishCustomThemes(
            owner,
            updated.themes,
            updated.active,
            replace.mutateAsync,
          );
        }

        // Remove the local copy only after the cloud rows no longer list it,
        // so a failed write leaves the theme available for a retry.
        for (const id of ids) {
          useThemeStore.getState().deleteThemeLocally(id);
        }
      } finally {
        setIsDeleting(false);
      }
    },
    [replace.mutateAsync],
  );

  return { deleteThemes, isDeleting };
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
