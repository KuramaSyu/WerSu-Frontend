import { ApiError } from "../SharingApi";
type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

/**
 * Converts an object of parameters into a URL query string.
 * @param params - An object containing query parameters. Values can be strings, numbers, booleans, arrays of these types, undefined, or null.
 * @returns A formatted query string prefixed with '?' if parameters exist, otherwise an empty string.
 * @example
 * toQueryString({ name: 'John', age: 30 })
 * // Returns: "?name=John&age=30"
 * @example
 * toQueryString({ tags: ['javascript', 'typescript'] })
 * // Returns: "?tags=javascript&tags=typescript"
 */
export function toQueryString<T extends object>(params: T): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item));
      }
      continue;
    }

    searchParams.set(key, String(value));
  }

  const qs = searchParams.toString();
  return qs.length > 0 ? `?${qs}` : "";
}
/**
 * Reads and parses the error payload from a Response object.
 *
 * Attempts to parse the response body based on its content type:
 * - If content type is JSON, parses and returns the JSON payload
 * - Otherwise, returns the response text as a message
 * - Falls back to the response status text if no body is available
 *
 * @param response - The Response object to read the error payload from
 * @returns A promise that resolves to the parsed error payload or an error message object
 * @throws Never throws - all errors are caught and converted to error message objects
 */
export async function readErrorPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return { message: "Failed to parse JSON error body" };
    }
  }

  try {
    const text = await response.text();
    return text.length ? { message: text } : { message: response.statusText };
  } catch {
    return { message: response.statusText };
  }
}

/**
 * Extracts an error message from a payload object.
 *
 * Attempts to retrieve an error message by checking the following in order:
 * 1. The `message` property of the payload object
 * 2. The first string value found in the payload object
 * 3. Returns the fallback message if neither is found or payload is not an object
 *
 * @param payload - The payload object to extract an error message from
 * @param fallback - The default error message to return if no message is found in the payload
 * @returns The error message extracted from the payload, or the fallback message if extraction fails
 */
export function errorMessageFromPayload(
  payload: unknown,
  fallback: string,
): string {
  if (payload && typeof payload === "object") {
    const maybeMessage = (payload as Record<string, unknown>).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0)
      return maybeMessage;

    const firstValue = Object.values(payload as Record<string, unknown>).find(
      (v) => typeof v === "string",
    );
    if (typeof firstValue === "string" && firstValue.trim().length > 0)
      return firstValue;
  }

  return fallback;
}

/**
 * Sends a JSON request to the specified endpoint and parses the response.
 *
 * @template T - The expected type of the response data.
 * @param endpoint - The URL endpoint to send the request to.
 * @param init - Optional fetch RequestInit configuration (headers, method, body, etc.).
 * @returns A promise that resolves to the parsed response data of type T.
 * @throws {ApiError} If the HTTP response status is not ok (2xx), containing the error message, status code, and error payload.
 *
 * @remarks
 * - Automatically includes credentials in the request.
 * - Sets the Accept header to "application/json".
 * - Returns undefined (cast as T) for 204 No Content responses.
 * - Parses response as JSON if the content-type header includes "application/json".
 * - Falls back to parsing as plain text if content-type is not JSON.
 */
export async function requestJson<T>(
  endpoint: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(endpoint, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new ApiError(
      errorMessageFromPayload(
        payload,
        `Request failed with HTTP ${response.status}`,
      ),
      response.status,
      payload,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}
