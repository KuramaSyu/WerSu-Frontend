/**
 * Helpers for building the public URL of a share.
 *
 * Kept out of the component files (`ShareCard.tsx` / `ShareDialog.tsx`)
 * so both can share one implementation without violating the
 * "component modules only export components" fast-refresh convention.
 */

/**
 * Default base used for share links. Prefers the current origin so the
 * link points at the same host the user is using (handles self-hosted
 * deployments and dev servers without extra configuration).
 */
export const DEFAULT_SHARE_URL_BASE =
  typeof window !== "undefined" ? window.location.origin : "";

/**
 * Build the public URL for a share id:
 *
 *   `${base}/public/n/${shareId}`
 *
 * Returns `""` for an empty id so callers can cheaply skip copying or
 * rendering a bogus link. A trailing slash on the base is tolerated.
 */
export const buildShareUrl = (
  shareId: string,
  shareUrlBase: string = DEFAULT_SHARE_URL_BASE,
): string => {
  if (!shareId) return "";
  const base = shareUrlBase.replace(/\/$/, "");
  return `${base}/public/n/${shareId}`;
};
