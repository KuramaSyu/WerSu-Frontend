/*
  REST client for `/api/preferences`.

  Preferences are server-side JSON blobs keyed by a `(scope, target_id)`
  pair. This module exposes the four operations the backend supports:

    - `getPreferences`     -> GET    /api/preferences
    - `replacePreferences` -> POST   /api/preferences
    - `mergePreferences`   -> PATCH  /api/preferences
    - `deletePreferences`  -> DELETE /api/preferences

  The `AbstractPreferencesApi` / `RestPreferencesApi` split follows the same
  pattern as `SharingApi` and `ShelfApi`: tests can register an alternative
  implementation in the `apiRegistry` without touching call sites, and
  `requestJson` normalises error handling.

  Wire types live in `./models/preferences`; TanStack hooks in
  `./queries/preferencesQueries`.
*/

import { BACKEND_BASE } from "../statics";
import type {
  DeletePreferencesEndpointReply,
  DeletePreferencesEndpointRequest,
  GetPreferencesEndpointReply,
  GetPreferencesEndpointRequest,
  MergePreferencesEndpointReply,
  MergePreferencesEndpointRequest,
  ReplacePreferencesEndpointReply,
  ReplacePreferencesEndpointRequest,
} from "./models/preferences";
import { requestJson, toQueryString } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";

/**
 * REST surface for the `/api/preferences` endpoints.
 *
 * The concrete implementation is `RestPreferencesApi`; tests and plugin
 * code can swap it out via the `apiRegistry` (see `PREFERENCES_API_TOKEN`).
 */
export interface PreferencesApi {
  /**
   * Read the stored blob for a `(scope, target_id)` pair.
   * `GET /api/preferences?scope=…&target_id=…`
   *
   * Resolves with `data: {}` when no row exists (the backend does not 404).
   * Rejects with an `ApiError` on 400 (bad scope/query) or 500.
   */
  getPreferences(
    request: GetPreferencesEndpointRequest,
  ): Promise<GetPreferencesEndpointReply>;

  /**
   * Replace the stored blob wholesale with `request.data`.
   * `POST /api/preferences`
   *
   * Unlike `mergePreferences` this does not preserve unrelated keys. Rejects
   * with an `ApiError` on 400, 403 (not allowed for the scope), or 500.
   */
  replacePreferences(
    request: ReplacePreferencesEndpointRequest,
  ): Promise<ReplacePreferencesEndpointReply>;

  /**
   * Shallow-merge `request.data` into the stored blob.
   * `PATCH /api/preferences`
   *
   * Top-level keys overwrite the same keys in storage; nested objects and
   * lists are replaced wholesale (not deep-merged). Rejects with an
   * `ApiError` on 400, 403 (not allowed for the scope), or 500.
   */
  mergePreferences(
    request: MergePreferencesEndpointRequest,
  ): Promise<MergePreferencesEndpointReply>;

  /**
   * Drop the stored blob for a `(scope, target_id)` pair.
   * `DELETE /api/preferences`
   *
   * Idempotent: the reply's `success` is `true` iff a row was actually
   * removed. Rejects with an `ApiError` on 400, 403 (not allowed for the
   * scope), or 500.
   */
  deletePreferences(
    request: DeletePreferencesEndpointRequest,
  ): Promise<DeletePreferencesEndpointReply>;
}

/**
 * Abstract base class for `PreferencesApi` implementations. Exists so the
 * REST implementation can be substituted in tests without changing the
 * public type.
 */
export abstract class AbstractPreferencesApi implements PreferencesApi {
  abstract getPreferences(
    request: GetPreferencesEndpointRequest,
  ): Promise<GetPreferencesEndpointReply>;
  abstract replacePreferences(
    request: ReplacePreferencesEndpointRequest,
  ): Promise<ReplacePreferencesEndpointReply>;
  abstract mergePreferences(
    request: MergePreferencesEndpointRequest,
  ): Promise<MergePreferencesEndpointReply>;
  abstract deletePreferences(
    request: DeletePreferencesEndpointRequest,
  ): Promise<DeletePreferencesEndpointReply>;
}

/**
 * Default `PreferencesApi` implementation backed by the GoToHell REST API.
 * All calls go through `requestJson`, which throws `ApiError` for non-2xx
 * responses.
 */
export class RestPreferencesApi extends AbstractPreferencesApi {
  /** `GET /api/preferences` — query params are built from the request. */
  async getPreferences(
    request: GetPreferencesEndpointRequest,
  ): Promise<GetPreferencesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/preferences${toQueryString(request)}`;
    return await requestJson<GetPreferencesEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  /** `POST /api/preferences` — overwrites the stored blob. */
  async replacePreferences(
    request: ReplacePreferencesEndpointRequest,
  ): Promise<ReplacePreferencesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/preferences`;
    return await requestJson<ReplacePreferencesEndpointReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  /** `PATCH /api/preferences` — shallow-merges into the stored blob. */
  async mergePreferences(
    request: MergePreferencesEndpointRequest,
  ): Promise<MergePreferencesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/preferences`;
    return await requestJson<MergePreferencesEndpointReply>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  /** `DELETE /api/preferences` — drops the stored blob (idempotent). */
  async deletePreferences(
    request: DeletePreferencesEndpointRequest,
  ): Promise<DeletePreferencesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/preferences`;
    return await requestJson<DeletePreferencesEndpointReply>(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }
}

/** Shared singleton used by the query hooks and exported for direct use. */
export const preferencesApi: PreferencesApi = new RestPreferencesApi();

// Register the concrete REST singleton under a typed token so consumers
// can resolve it via `getPreferencesApi()`. The bare `preferencesApi`
// export above stays for backward compatibility with the rest of the call
// sites.
apiRegistry.register(preferencesApi as RestPreferencesApi);
export const PREFERENCES_API_TOKEN: ApiToken<RestPreferencesApi> = Symbol(
  "RestPreferencesApi",
) as ApiToken<RestPreferencesApi>;
apiRegistry.register(
  preferencesApi as RestPreferencesApi,
  PREFERENCES_API_TOKEN,
);

/**
 * Resolve the registered `RestPreferencesApi` singleton.
 *
 * Throws if the API isn't registered (see `apiRegistry.get` for the
 * rationale — silent `undefined` lookups hide auth wiring bugs).
 */
export function getPreferencesApi(): RestPreferencesApi {
  return apiRegistry.get<RestPreferencesApi>(PREFERENCES_API_TOKEN);
}
