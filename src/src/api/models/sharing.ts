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
 * Public, unauthenticated view of a share — what the backend returns from
 * `GET /api/shares?share_id=...` (or by hitting the share URL directly).
 *
 * This is the "public token" grant: it tells the client which note the share
 * exposes, what access level (`access_as`) the bearer gets, and the active
 * time window during which the share is valid.
 *
 * When the backend issues a share JWT inline it is exposed via `share_token`.
 * If absent, callers should call `SharingApi.fetchShareAccessToken(share_id)`
 * to obtain one.
 */
export interface GetPublicShareResponse {
  note_id?: string;
  access_as?: string;
  online_since?: string;
  online_until?: string;
  /** Optional share access JWT, attached to `Authorization: Bearer <token>`. */
  share_token?: string;
}

/**
 * Reply of `fetchShareAccessToken` — the share JWT plus its expiry in seconds.
 * Mirrors `GetAcccessTokenResponse` for the regular user JWT.
 */
export interface FetchShareAccessTokenResponse {
  token: string;
  /** Seconds until the token expires, if the backend reports it. */
  expires_in?: number;
}

export interface GetPublicShareRequest {
  /** Bare share ID (not a URL). Use `extractShareIdFromUrl` first when needed. */
  share_id: string;
}

export type GetPublicShareEndpointRequest = GetPublicShareRequest;
export type GetPublicShareEndpointReply = GetPublicShareResponse;
