export interface NoteShareReply {
  id: string;
  description?: string;
  note_id: string;
  created_at?: string;
  created_by: string;
  online_since?: string;
  online_until?: string;
  permission: string;
}

export interface CreateShareBody {
  description?: string;
  note_id: string;
  online_since?: string;
  online_until?: string;
  permission: string;
}

export interface UpdateShareBody {
  id: string;
  description?: string;
  note_id: string;
  online_since?: string;
  online_until?: string;
  permission: string;
}

export interface DeleteSharesBody {
  share_ids: string[];
}

export interface GetSharesQuery {
  note_id?: string;
  created_by?: string;
  online_since?: string;
  online_until?: string;
}

export interface GetSharesByIdRequest {
  share_ids: string[];
}

export interface GetShareByIdRequest {
  id: string;
}

export interface CreateShareEndpointRequest {
  share: CreateShareBody;
}
export type CreateShareEndpointReply = NoteShareReply;

export interface UpdateShareEndpointRequest {
  share: UpdateShareBody;
}
export type UpdateShareEndpointReply = NoteShareReply;

export type GetSharesByIdEndpointRequest = GetSharesByIdRequest;
export type GetSharesByIdEndpointReply = NoteShareReply[];

export type GetSharesEndpointRequest = GetSharesQuery;
export type GetSharesEndpointReply = NoteShareReply[];

export type DeleteSharesEndpointRequest = DeleteSharesBody;
export type DeleteSharesEndpointReply = void;

export type GetShareByIdEndpointRequest = GetShareByIdRequest;
export type GetShareByIdEndpointReply = NoteShareReply;

/**
 * Possible values for `GetPublicShareResponse.permission`. Mirrors the proto
 * enum `SharePermission` documented in the Go backend.
 */
export type SharePermission =
  | "SHARE_PERMISSION_UNSPECIFIED"
  | "SHARE_PERMISSION_READ"
  | "SHARE_PERMISSION_WRITE";

/**
 * Public, unauthenticated view of a share — what the backend returns from
 * `GET /api/shares?share_id=...` (or by hitting the share URL directly).
 *
 * This is the "public token" grant: it tells the client which note the share
 * exposes, what access level (`permission`) the bearer gets, and the active
 * time window during which the share is valid.
 *
 * Callers obtain a JWT by POSTing to `/api/auth/public-access-token` via
 * `SharingApi.fetchPublicAccessToken(share_id)` — there is no inline
 * `share_token` in this response.
 */
export interface GetPublicShareResponse {
  note_id?: string;
  /**
   * @deprecated Kept for parity with the wire format; prefer `permission`.
   * Will be removed once the backend stops returning it.
   */
  access_as?: string;
  /**
   * The granted access level. Canonical source of truth for "what can the
   * viewer do with the shared note".
   */
  permission?: SharePermission;
  online_since?: string;
  online_until?: string;
}

/**
 * Reply of `fetchPublicAccessToken` — the share JWT issued by
 * `POST /api/auth/public-access-token`. The token's `exp` claim already
 * encodes `online_until`, so clients don't need `expires_in` to schedule
 * a rotation.
 */
export interface PostPublicAccessTokenReply {
  token: string;
}

export interface GetPublicShareRequest {
  /** Bare share ID (not a URL). Use `extractShareIdFromUrl` first when needed. */
  share_id: string;
}

export type GetPublicShareEndpointRequest = GetPublicShareRequest;
export type GetPublicShareEndpointReply = GetPublicShareResponse;
