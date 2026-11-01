import { getAttachmentApi } from "../api/AttachmentApi";
import { AttachmentLinkBuilder } from "../api/utils/AttachmentLInkBuilder";
import { extractAttachmentKeyFromUrl } from "../api/utils/request_helpers";
import type { GeneratedThemeRecord } from "../theme/imageTheme";

/** Background width used when fetching synced theme images on desktop. */
export const SYNCED_THEME_IMAGE_WIDTH_DESKTOP = 1080;

/** Background width used when fetching synced theme images on mobile. */
export const SYNCED_THEME_IMAGE_WIDTH_MOBILE = 720;

/**
 * True when `source` points at one of our attachment endpoints: either the
 * `linkAttachment` shape (`/attachments/<key>`) or an already-built image
 * URL (`/api/attachments/image?...`). An arbitrary remote image is not an
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
 * Rewrite a synced theme's remote background images to the attachment image
 * endpoint at `width`.
 *
 * `publishCustomThemes` stores whatever `linkAttachment` returned
 * (`/attachments/<key>`); here we recover the raw attachment key and feed it
 * through `AttachmentLinkBuilder` so the browser downloads a width-capped
 * WebP variant (e.g. `.../api/attachments/image?width=1080&format=webp&key=…`)
 * instead of the original object. Empty values, device-local `local:<id>`
 * blobs and non-attachment URLs pass through untouched.
 */
export function withSyncedImageWidth(
  record: GeneratedThemeRecord,
  width: number,
): GeneratedThemeRecord {
  const attachmentApi = getAttachmentApi();

  const rewrite = (source: string): string => {
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
    return new AttachmentLinkBuilder(attachmentApi)
      .setWidth(width)
      .setFormat("webp")
      .getLink(key);
  };

  return {
    ...record,
    backgroundImage: rewrite(record.backgroundImage),
    blurredBackgroundImage: rewrite(record.blurredBackgroundImage),
  };
}
