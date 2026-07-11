import { BACKEND_BASE } from "../statics";

/**
 * Normalises a user- or backend-supplied URL so the caller can drop the
 * result into an `<img src>` (or any other fetcher) without worrying
 * about whether the original string was absolute, backend-relative, or
 * already prefixed.
 *
 * Behaviour:
 *
 *   - empty / null / undefined   -> returned as-is.
 *   - `data:`, `blob:`, `http://`, `https://` -> returned as-is
 *     (already absolute / opaque).
 *   - protocol-relative `//foo`  -> returned as-is.
 *   - leading `/` (backend-relative path, e.g. `/api/attachments/...`)
 *     -> prefixed with `BACKEND_BASE`.
 *   - anything else (treated as a backend-relative path with no
 *     leading slash) -> prefixed with `${BACKEND_BASE}/`.
 *
 * Pure function; safe to call on every render.
 */
export function prepareBackendLink(input: string | null | undefined): string {
  if (!input) return input ?? "";
  // Already absolute or an opaque URL we shouldn't touch.
  if (
    input.startsWith("http://") ||
    input.startsWith("https://") ||
    input.startsWith("//") ||
    input.startsWith("data:") ||
    input.startsWith("blob:")
  ) {
    return input;
  }
  if (input.startsWith("/")) {
    return `${BACKEND_BASE}${input}`;
  }
  return `${BACKEND_BASE}/${input}`;
}
