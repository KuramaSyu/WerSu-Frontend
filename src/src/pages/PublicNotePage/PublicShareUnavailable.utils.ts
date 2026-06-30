import { ApiError } from "../../api/SharingApi";

/**
 * Pulled-out view of whatever `error` the caller hands us. Used by
 * `PublicShareUnavailable` to decide what to render in the title
 * (status-driven heading) and in the body (server message + raw
 * payload).
 */
export interface ExtractedError {
  message: string;
  status?: number;
  payload?: unknown;
  name?: string;
}

/**
 * Extracts a stable shape out of whatever `error` is - supports
 * `ApiError` (rich payload + status), generic `Error`, bare strings,
 * and a `fallbackReason` for the case where the caller no longer
 * has the original error object.
 *
 * Kept in a sibling file so the React Fast Refresh plugin doesn't
 * blow up on a non-component export from a `.tsx` file.
 */
export const extractError = (
  error: unknown,
  fallbackReason?: string,
): ExtractedError => {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      status: error.status,
      payload: error.payload,
      name: error.name,
    };
  }
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return { message: error };
  }
  if (fallbackReason && fallbackReason.trim().length > 0) {
    return { message: fallbackReason };
  }
  return { message: "Unknown error" };
};

/**
 * Renders the response body for the diagnostic panel. Strings are
 * returned as-is, structured values are pretty-printed JSON, and
 * pathological inputs (circular refs, BigInts) fall back to
 * `String()` coercion so the panel never throws.
 */
export const formatPayload = (payload: unknown): string => {
  if (payload === undefined) return "(empty body)";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    // Circular refs / BigInts -> fall back to String() coercion.
    return String(payload);
  }
};

/**
 * Maps an HTTP status code to a short, human-friendly title used in
 * the error page's heading. Exposed so tests can pin the mapping
 * without having to render the component.
 *
 * The mapping covers the status codes the public-share flow can
 * realistically produce (the share grant + the note GET are the
 * two endpoints we hit). Anything not on the list falls back to a
 * generic "Request failed" so the page never says nothing.
 */
export const statusTitle = (status: number): string => {
  switch (status) {
    case 400:
      return "Bad request";
    case 401:
      return "Not authenticated";
    case 403:
      return "Access denied";
    case 404:
      return "Share not found";
    case 410:
      return "Share expired or revoked";
    case 429:
      return "Too many requests";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Server error";
    default:
      return status >= 500 ? "Server error" : "Request failed";
  }
};

/**
 * Picks the chip severity for the HTTP status badge. Mirrors the
 * logic that used to live inside the component so tests can pin it
 * in isolation.
 */
export const statusChipSeverity = (
  status: number,
): "error" | "warning" | "default" => {
  if (status >= 500) return "error";
  if (status === 404 || status === 410) return "warning";
  return "default";
};
