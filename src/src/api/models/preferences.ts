/**
 * Wire types for the `/api/preferences` REST surface.
 *
 * Preferences are stored server-side as an opaque JSON blob keyed by a
 * `(scope, target_id)` pair. The backend does not interpret the contents of
 * `data`; it only reads/writes/merges the blob. The concrete JSON schema is
 * defined by the frontend (see `src/models/Preferences.ts` and the various
 * zustand stores that consume these endpoints).
 *
 * Endpoints (see `docs/swagger.json` in the backend):
 *   - `GET    /api/preferences` — read the blob (`GetPreferencesQuery` in,
 *     `PreferencesReply` out). Returns `{}` when no row exists.
 *   - `POST   /api/preferences` — replace the blob wholesale
 *     (`PreferencesJsonBody` in, `PreferencesReply` out).
 *   - `PATCH  /api/preferences` — shallow-merge into the blob
 *     (`PreferencesJsonBody` in, `PreferencesReply` out).
 *   - `DELETE /api/preferences` — drop the blob
 *     (`DeletePreferencesBody` in, `DeletePreferencesReply` out).
 */

/**
 * Scope that the preference blob is attached to.
 *
 * - `"user"`  — a single user's personal preferences.
 * - `"shelf"` — preferences shared by everyone viewing a shelf.
 * - `"role"`  — preferences shared by everyone holding a role.
 */
export type PreferenceScope = "user" | "shelf" | "role";

/**
 * Query string parameters for `GET /api/preferences`.
 * Both fields are required by the backend.
 */
export interface GetPreferencesQuery {
  /** Scope the blob is stored under. */
  scope: PreferenceScope;
  /** Id of the entity the scope points at (e.g. user id, shelf id). */
  target_id: string;
}

/**
 * JSON body shared by `POST /api/preferences` (replace) and
 * `PATCH /api/preferences` (shallow merge).
 *
 * On `POST` the stored row is overwritten entirely. On `PATCH` the
 * top-level keys of `data` overwrite the same keys in storage; nested
 * objects and arrays are replaced wholesale (no deep merge).
 */
export interface PreferencesJsonBody {
  /** Scope the blob is stored under. */
  scope: PreferenceScope;
  /** Id of the entity the scope points at. */
  target_id: string;
  /** Preference payload. Free-form JSON; the backend stores it verbatim. */
  data: Record<string, unknown>;
}

/**
 * JSON body for `DELETE /api/preferences`.
 * Identifies the `(scope, target_id)` pair whose blob should be dropped.
 */
export interface DeletePreferencesBody {
  /** Scope the blob is stored under. */
  scope: PreferenceScope;
  /** Id of the entity the scope points at. */
  target_id: string;
}

/**
 * Reply for `GET`, `POST`, and `PATCH /api/preferences`.
 *
 * Echoes back the `(scope, target_id)` pair along with the currently stored
 * blob, so callers can confirm exactly what was persisted. For `GET` with no
 * existing row, `data` is `{}`.
 */
export interface PreferencesReply {
  /** Scope the blob is stored under. */
  scope: PreferenceScope;
  /** Id of the entity the scope points at. */
  target_id: string;
  /** Currently stored preference payload. */
  data: Record<string, unknown>;
}

/**
 * Reply for `DELETE /api/preferences`.
 *
 * The operation is idempotent: `success` is `true` iff a row was actually
 * removed, and `false` if the blob was already absent.
 */
export interface DeletePreferencesReply {
  /** `true` when a stored row was deleted; `false` when none existed. */
  success: boolean;
}

/** Request accepted by `getPreferences` (`GET /api/preferences`). */
export type GetPreferencesEndpointRequest = GetPreferencesQuery;
/**
 * Reply returned by `getPreferences`; `data` is `{}` when nothing is stored.
 */
export type GetPreferencesEndpointReply = PreferencesReply;

/** Request accepted by `replacePreferences` (`POST /api/preferences`). */
export type ReplacePreferencesEndpointRequest = PreferencesJsonBody;
/** Reply returned by `replacePreferences` with the newly stored blob. */
export type ReplacePreferencesEndpointReply = PreferencesReply;

/** Request accepted by `mergePreferences` (`PATCH /api/preferences`). */
export type MergePreferencesEndpointRequest = PreferencesJsonBody;
/** Reply returned by `mergePreferences` with the post-merge blob. */
export type MergePreferencesEndpointReply = PreferencesReply;

/** Request accepted by `deletePreferences` (`DELETE /api/preferences`). */
export type DeletePreferencesEndpointRequest = DeletePreferencesBody;
/** Reply returned by `deletePreferences` indicating whether a row was removed. */
export type DeletePreferencesEndpointReply = DeletePreferencesReply;
