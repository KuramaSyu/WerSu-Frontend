import { getAttachmentApi } from "../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../api/utils/AttachmentLInkBuilder";
import { extractAttachmentKeyFromUrl } from "../api/utils/request_helpers";
import type { GeneratedThemeRecord } from "../theme/imageTheme";
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
  // A device-local variant already exists (regenerated earlier, or a
  // locally-created theme that happens to share the id).
  if (record.blurredBackgroundImage.startsWith("local:")) {
    return record;
  }
  const cache = useImageBlobCacheStore.getState();
  const key = syncedBlurCacheKey(record.backgroundImage, record.blur);
  if ((await cache.resolve(key)) !== null) {
    return { ...record, blurredBackgroundImage: key };
  }

  const sourceEntry = await cache.resolve(record.backgroundImage);
  let sourceBlob = sourceEntry?.blob ?? null;
  if (sourceBlob === null && !record.backgroundImage.startsWith("local:")) {
    try {
      sourceBlob = await fetchImageBlob(record.backgroundImage);
      await cache.put(record.backgroundImage, sourceBlob);
    } catch {
      // CORS / offline: keep the sharp source (or server-preblurred URL).
      return record;
    }
  }
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
