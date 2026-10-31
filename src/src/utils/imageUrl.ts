/**
 * Rewrite a handful of well-known "web page" image URLs into a direct
 * asset URL.
 *
 * Color extraction and blur generation read pixels through a canvas,
 * which requires a CORS-clean image (`crossorigin="anonymous"`). Some
 * hosts serve images through a redirect whose response lacks valid CORS
 * headers, so the browser blocks the load even though the final asset
 * would be fine. GitHub's `github.com/<owner>/<repo>/{raw,blob}/...`
 * URLs are the notable offender: the 302 from `github.com` sends an
 * empty `Access-Control-Allow-Origin`, while
 * `raw.githubusercontent.com` sends `*`.
 *
 * The rewrite is intentionally conservative: anything that is not one
 * of the recognised shapes is returned unchanged.
 */
export function normalizeImageUrl(input: string): string {
  const raw = input.trim();
  if (raw.length === 0) {
    return raw;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  const host = url.hostname.toLowerCase();
  if (host === "github.com" || host === "www.github.com") {
    const parts = url.pathname.split("/").filter((part) => part.length > 0);
    // /<owner>/<repo>/(raw|blob)/<ref>/<path...>
    if (
      parts.length >= 5 &&
      (parts[2] === "raw" || parts[2] === "blob")
    ) {
      const owner = parts[0];
      const repo = parts[1];
      const ref = parts[3];
      const rest = parts.slice(4).join("/");
      return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest}`;
    }
  }

  return raw;
}
