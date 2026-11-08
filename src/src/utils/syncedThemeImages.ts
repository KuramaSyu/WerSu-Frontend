import { getAttachmentApi } from "../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../api/utils/AttachmentLInkBuilder";
import { extractAttachmentKeyFromUrl } from "../api/utils/request_helpers";
import type { GeneratedThemeRecord } from "../theme/imageTheme";
import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";
import { useImageBlobCacheStore } from "../zustand/useImageBlobCache";
import { blurImageToWebp, fetchImageBlob } from "./imageBlur";

/** Background width used when fetching synced theme images on desktop. */
export const SYNCED_THEME_IMAGE_WIDTH_DESKTOP = 1080;

/** Background width used when fetching synced theme images on mobile. */
export const SYNCED_THEME_IMAGE_WIDTH_MOBILE = 720;

/**
 * True when `source` points at one of our attachment endpoints: the
 * `linkAttachment` shape (`/api/attachments/?key=...`, or the legacy
 * `/attachments/<key>`), or an already-built image URL
 * (`/api/attachments/image?...`). An arbitrary remote image is not an
 * attachment and must be left alone — `extractAttachmentKeyFromUrl` would
 * otherwise mistake its last path segment for a key.
 */
function isAttachmentSource(source: string): boolean {
  let pathname = source;
  try {
    pathname = new URL(source).pathname;
  } catch {
    // Relative/empty base: fall back to the raw string.
  }
  return (
    pathname.startsWith("/attachments/") ||
    pathname.includes("/api/attachments/")
  );
}

/** True when `source` is already the built image endpoint. */
function isImageEndpoint(source: string): boolean {
  let pathname = source;
  try {
    pathname = new URL(source).pathname;
  } catch {
    // Relative/empty base: fall back to the raw string.
  }
  return pathname.includes("/api/attachments/image");
}

/**
 * Rewrite an attachment reference to the backend's image endpoint.
 *
 * `linkAttachment`/preferences persist different shapes over time:
 * the current `/api/attachments/?key=...` download URL and the legacy
 * `/attachments/<key>` path. There is no backend route for the path
 * form, so both are recovered to the raw key and fed through
 * `AttachmentLinkBuilder`, which emits the fetchable
 * `/api/attachments/image?[width=...&format=webp&]key=…` URL. Empty
 * values, device-local `local:<id>` blobs and non-attachment URLs pass
 * through untouched.
 *
 * `width` (optional) caps the requested image width; when omitted the
 * builder's own default applies.
 */
export function toAttachmentImageUrl(
  source: string,
  width: number | null = null,
): string {
  if (source.length === 0 || source.startsWith("local:")) {
    return source;
  }
  if (!isAttachmentSource(source)) {
    return source;
  }
  // An already-built image URL is left alone when the caller is not asking
  // for a specific width (e.g. `useCachedImageUrl`, which must keep the exact
  // URL that was cached). A requested width still rebuilds it.
  if (width === null && isImageEndpoint(source)) {
    return source;
  }
  const key = extractAttachmentKeyFromUrl(source);
  if (key.length === 0) {
    return source;
  }
  const builder = new AttachmentLinkBuilder(getAttachmentApi()).setFormat(
    "webp",
  );
  if (width !== null) {
    builder.setWidth(width);
  }
  return builder.getLink(key);
}

/**
 * Rewrite a synced theme's remote background images to the attachment image
 * endpoint at `width`.
 *
 * `publishCustomThemes` stores whatever `linkAttachment` returned; here we
 * recover the raw attachment key and feed it through
 * `AttachmentLinkBuilder` so the browser downloads a width-capped WebP
 * variant (e.g. `.../api/attachments/image?width=1080&format=webp&key=…`)
 * instead of the original object. Empty values, device-local `local:<id>`
 * blobs and non-attachment URLs pass through untouched.
 */
export function withSyncedImageWidth(
  record: GeneratedThemeRecord,
  width: number,
): GeneratedThemeRecord {
  return {
    ...record,
    backgroundImage: toAttachmentImageUrl(record.backgroundImage, width),
    blurredBackgroundImage: toAttachmentImageUrl(
      record.blurredBackgroundImage,
      width,
    ),
  };
}

/**
 * Deterministic IndexedDB key for a regenerated blurred variant. Keyed by
 * both the (already width-capped) source URL and the blur amount so a
 * reload or re-render reuses the persisted blob instead of re-rendering.
 */
export function syncedBlurCacheKey(source: string, blur: number): string {
  let hash = 5381;
  const input = `${source}|${String(blur)}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return `local:synced-blur-${hash.toString(36)}`;
}

/**
 * Deterministic IndexedDB key for a theme's full-resolution original.
 *
 * Kept separate from the render source (`record.backgroundImage`) so saving
 * the editor can always re-blur from the true original: the render source
 * may hold a width-capped WebP, and a `local:` source is overwritten every
 * time the blur changes. The original is never removed when a blur variant
 * is dropped.
 */
export function syncedOriginalCacheKey(source: string): string {
  let hash = 5381;
  const input = `${source}|original`;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return `local:synced-original-${hash.toString(36)}`;
}

/**
 * Download and persist a synced theme's sharp source background so rendering
 * the theme is an IndexedDB cache hit instead of a live (auth-protected)
 * image request.
 *
 * No-op for empty/device-local sources and for themes that already render
 * from a device-local blurred blob. Fetch failures (CORS/offline) leave the
 * remote URL in place as the render fallback.
 */
export async function cacheSyncedThemeImage(
  record: GeneratedThemeRecord,
): Promise<GeneratedThemeRecord> {
  const source = record.backgroundImage;
  if (source.length === 0 || source.startsWith("local:")) {
    return record;
  }
  if (
    record.blur > 0 &&
    record.blurredBackgroundImage === syncedBlurCacheKey(source, record.blur)
  ) {
    // The active background is already a local blob rendered for this exact
    // blur; nothing to download. A key from an older blur must not short
    // circuit here, or the sharp source would never be cached for the
    // regeneration below.
    return record;
  }
  const cache = useImageBlobCacheStore.getState();
  // Corruption marker from an earlier bug: the blurred variant was stored
  // under the source key itself, so the cached "source" is actually blurred
  // pixels. Drop the entry so the sharp source is re-downloaded below.
  if (
    record.blur > 0 &&
    record.blurredBackgroundImage === source &&
    !source.startsWith("local:")
  ) {
    await cache.remove(source);
  } else if (
    (await cache.resolve(source)) !== null ||
    (await cache.resolve(syncedOriginalCacheKey(source))) !== null
  ) {
    // Never replace a full-resolution original with the compressed source.
    return record;
  }
  try {
    const blob = await fetchImageBlob(source);
    // Re-check after the await: the editor may have cached the
    // full-resolution original while the compressed download was in flight.
    if ((await cache.resolve(syncedOriginalCacheKey(source))) === null) {
      await cache.put(source, blob);
    }
  } catch {
    // CORS / offline: keep the remote URL as the render fallback.
  }
  return record;
}

/**
 * Recover the raw attachment key from a theme background, or `null` when the
 * source is empty, device-local, or not one of our attachments.
 */
export function themeAttachmentKey(source: string): string | null {
  if (source.length === 0 || source.startsWith("local:")) {
    return null;
  }
  if (!isAttachmentSource(source)) {
    return null;
  }
  const key = extractAttachmentKeyFromUrl(source);
  return key.length > 0 ? key : null;
}

/**
 * Fetch and cache a synced theme's full-resolution original so its
 * palette/blur can be re-edited faithfully.
 *
 * The sync pass caches a width-capped WebP (see `cacheSyncedThemeImage`),
 * which is fine for rendering but lossy for regenerating the blur. The
 * original is fetched through the authenticated attachment download endpoint
 * (not the `image` endpoint) and stored under two keys: the dedicated
 * `syncedOriginalCacheKey` (the editor always reads this first, and it is
 * never overwritten by a compressed sync) and the render source itself (so
 * rendering after a blur=0 edit shows the true original).
 *
 * Returns `true` when the original was fetched and stored. No-op (returns
 * `false`) for local/external sources and download failures, so the caller
 * can keep the compressed bytes as a fallback.
 */
export async function cacheOriginalThemeImage(
  record: GeneratedThemeRecord,
): Promise<boolean> {
  const key = themeAttachmentKey(record.backgroundImage);
  if (key === null) {
    return false;
  }
  let blob: Blob | null;
  try {
    blob = await getAttachmentApi().getAttachment(key);
  } catch {
    return false;
  }
  if (blob === null) {
    return false;
  }
  const cache = useImageBlobCacheStore.getState();
  await cache.put(syncedOriginalCacheKey(record.backgroundImage), blob);
  await cache.put(record.backgroundImage, blob);
  return true;
}

/**
 * Heal a theme's cached image bytes after a lost/corrupted IndexedDB state.
 *
 * Handles the two known failure shapes:
 * - blurred pixels stored under the source key (the earlier overwrite bug):
 *   the source entry is dropped so the sharp image is re-downloaded;
 * - a missing blurred variant (write never landed or the store was cleared):
 *   `ensureSyncedBlur` re-renders it from the sharpest available source.
 *
 * Returns the record with a (possibly unchanged) `blurredBackgroundImage`.
 * Safe to run on every boot for every theme.
 */
export async function repairThemeImageCache(
  record: GeneratedThemeRecord,
): Promise<GeneratedThemeRecord> {
  await cacheSyncedThemeImage(record);
  return await ensureSyncedBlur(record);
}

/**
 * Fetch and cache a theme's compressed background as a last resort.
 *
 * Unlike `cacheOriginalThemeImage` this never touches the dedicated original
 * key, so the editor still knows the sharp pixels are missing and will retry
 * the full-resolution download (then upgrade the render source) on the next
 * edit.
 */
export async function cacheSyncedThemeImageFallback(
  source: string,
  width: number = SYNCED_THEME_IMAGE_WIDTH_DESKTOP,
): Promise<boolean> {
  if (source.length === 0 || source.startsWith("local:")) {
    return false;
  }
  const cache = useImageBlobCacheStore.getState();
  if (
    (await cache.resolve(source)) !== null ||
    (await cache.resolve(syncedOriginalCacheKey(source))) !== null
  ) {
    return false;
  }
  const blob = await fetchAttachmentImageFallback(
    themeAttachmentKey(source),
    width,
    source,
  );
  return blob !== null;
}

/**
 * Resolve the sharpest available pixels for a theme background.
 *
 * Prefers the full-resolution original saved for editing, then the render
 * source, then a fresh download (normalising attachment links to the image
 * endpoint). Returns `null` when nothing can be resolved.
 */
export async function resolveThemeSourceBlob(
  record: GeneratedThemeRecord,
): Promise<Blob | null> {
  const cache = useImageBlobCacheStore.getState();
  const original = await cache.resolve(
    syncedOriginalCacheKey(record.backgroundImage),
  );
  if (original !== null) {
    return original.blob;
  }
  const source = await cache.resolve(record.backgroundImage);
  if (source !== null) {
    return source.blob;
  }
  if (
    record.backgroundImage.length === 0 ||
    record.backgroundImage.startsWith("local:")
  ) {
    return null;
  }
  try {
    const blob = await fetchImageBlob(
      toAttachmentImageUrl(record.backgroundImage),
    );
    await cache.put(record.backgroundImage, blob);
    return blob;
  } catch {
    return null;
  }
}

/**
 * Download an attachment key from the image endpoint (the width-capped WebP
 * variant) and store it under `cacheKey`.
 *
 * This is the degraded fallback used when a theme's cached bytes went missing
 * (IndexedDB cleared, another browser) or the full-resolution download fails:
 * the backend can still regenerate a compressed variant from the stored
 * object, so the theme renders instead of showing nothing. Returns `null` when
 * there is no key or the download fails.
 */
async function fetchAttachmentImageFallback(
  key: string | null,
  width: number,
  cacheKey: string,
): Promise<Blob | null> {
  if (key === null) {
    return null;
  }
  try {
    const url = new AttachmentLinkBuilder(getAttachmentApi())
      .setFormat("webp")
      .setWidth(width)
      .getLink(key);
    const blob = await fetchImageBlob(url);
    await useImageBlobCacheStore.getState().put(cacheKey, blob);
    return blob;
  } catch {
    return null;
  }
}

/**
 * Re-download a synced theme's compressed background when its cached bytes
 * are missing, so a render always has something to show.
 *
 * Tries the full-resolution original first (upgrading a theme to sharp pixels
 * on the way) and falls back to the width-capped image variant when the
 * object is gone. The result is stored under the render source so the next
 * render is a cache hit, and — when it is the original — under
 * `syncedOriginalCacheKey` as well, so the editor later upgrades for free.
 *
 * Returns `null` for device-local/external sources and when every download
 * fails.
 */
export async function refetchSyncedThemeImage(
  record: GeneratedThemeRecord,
  width: number = SYNCED_THEME_IMAGE_WIDTH_DESKTOP,
): Promise<Blob | null> {
  const source = record.backgroundImage;
  if (source.length === 0 || source.startsWith("local:")) {
    return null;
  }
  const cache = useImageBlobCacheStore.getState();
  const originalKey = syncedOriginalCacheKey(source);
  if ((await cache.resolve(originalKey)) !== null) {
    // The sharp pixels are already here; nothing to repair.
    return null;
  }
  const rawKey = themeAttachmentKey(source);
  if (rawKey !== null) {
    try {
      const original = await getAttachmentApi().getAttachment(rawKey);
      if (original !== null) {
        await cache.put(originalKey, original);
        await cache.put(source, original);
        return original;
      }
    } catch {
      // Fall through to the compressed variant.
    }
  }
  return await fetchAttachmentImageFallback(rawKey, width, source);
}

/**
 * Make sure a downloaded theme has a device-local blurred background.
 *
 * Published themes only carry the source image URL plus the `blur` amount,
 * so the consuming client re-renders the blur here and caches it under a
 * deterministic `local:` key. The source is read from the blob cache when
 * present, otherwise fetched and cached (which also benefits the actual
 * background render).
 *
 * Returns the record unchanged when blur is disabled, the source is
 * missing, or the blur already exists as a local blob.
 */
export async function ensureSyncedBlur(
  record: GeneratedThemeRecord,
): Promise<GeneratedThemeRecord> {
  if (record.blur <= 0 || record.backgroundImage.length === 0) {
    return record;
  }
  // Manual-blur mode: nothing is pre-rendered or persisted, so leave the
  // record without a `local:` blurred variant. `AppBackground` blurs the
  // sharp source on the fly instead.
  const flags = useFeatureStore.getState().flags;
  if (
    !flags[FeatureFlagName.PreRenderThemeBlur] ||
    flags[FeatureFlagName.DisableBlur]
  ) {
    return record;
  }
  const cache = useImageBlobCacheStore.getState();
  // The deterministic key encodes the source and the blur the blob was
  // rendered with, so a matching pointer plus a live cache entry means the
  // variant is current. Anything else — empty, or a `local:` key from an
  // earlier blur — is stale and must be re-rendered from the source.
  const key = syncedBlurCacheKey(record.backgroundImage, record.blur);
  if (record.blurredBackgroundImage === key) {
    const cached = await cache.resolve(key);
    if (cached !== null) {
      return record;
    }
  }

  // Read the sharp source (original preferred) without ever writing the
  // blurred result back onto it, so the two always coexist in the cache.
  const sourceBlob = await resolveThemeSourceBlob(record);
  if (sourceBlob === null) {
    return record;
  }
  try {
    const blurred = await blurImageToWebp(sourceBlob, record.blur);
    await cache.put(key, blurred);
    return { ...record, blurredBackgroundImage: key };
  } catch {
    // No canvas / unsupported format: keep the sharp source.
    return record;
  }
}
