/**
 * Wire types for the `/api/preferences` REST surface.
 *
 * Preferences are stored server-side as an opaque JSON blob keyed by a
 * `(scope, target_id)` pair. The backend does not interpret the contents of
 * `preferences_json`; it only reads/writes/merges the blob. The concrete
 * JSON schema is defined by the frontend (see `src/models/Preferences.ts`
 * and the various zustand stores that consume these endpoints).
 *
 * The `preferences_json` field carries a `PreferencesData` payload (see
 * `src/models/Preferences.ts`) as a JSON-encoded **string**, e.g.
 * `"{\"version\":1,\"theme\":{...}}"`. Use `JSON.stringify` when
 * sending and `parseStoredPreferences` when reading.
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
  /**
   * Optional sub-key within the scope. Omit it to read the default blob.
   * Provide one to read a separate, isolated blob for that key (e.g.
   * `"custom-themes"`). A single owner can hold at most 50 keys.
   */
  key?: string;
}

/**
 * JSON body shared by `POST /api/preferences` (replace) and
 * `PATCH /api/preferences` (shallow merge).
 *
 * On `POST` the stored row is overwritten entirely. On `PATCH` the
 * top-level keys of `preferences_json` overwrite the same keys in storage;
 * nested objects and arrays are replaced wholesale (no deep merge).
 */
export interface PreferencesJsonBody {
  /** Scope the blob is stored under. */
  scope: PreferenceScope;
  /** Id of the entity the scope points at. */
  target_id: string;
  /**
   * Optional sub-key within the scope. Omit it to write the default blob;
   * pass one (e.g. `"custom-themes"`) to keep unrelated preference topics
   * in their own isolated row.
   */
  key?: string;
  /**
   * Preference payload as a JSON-encoded string (the backend stores the
   * string verbatim). `JSON.stringify` the frontend's `PreferencesData`
   * (version + theme) before assigning.
   */
  preferences_json: string;
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
  /** Optional sub-key within the scope; omit to delete the default blob. */
  key?: string;
}

/**
 * Reply for `GET`, `POST`, and `PATCH /api/preferences`.
 *
 * Echoes back the `(scope, target_id)` pair along with the currently stored
 * blob, so callers can confirm exactly what was persisted. For `GET` with no
 * existing row, `preferences_json` is empty (`""` / `"{}"`).
 */
export interface PreferencesReply {
  /** Scope the blob is stored under. */
  scope: PreferenceScope;
  /** Id of the entity the scope points at. */
  target_id: string;
  /** Sub-key the blob is stored under; omitted/`""` for the default blob. */
  key?: string;
  /**
   * Currently stored preference payload, JSON-encoded. Readers should
   * decode with `parseStoredPreferences` rather than `JSON.parse`.
   */
  preferences_json: string;
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
 * Reply returned by `getPreferences`; `preferences_json` is empty when
 * nothing is stored.
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
