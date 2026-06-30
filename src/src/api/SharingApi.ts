/*
  Sharing-only TanStack-friendly REST client for the GoToHell API.

  Two surfaces, two APIs:
  - `SharingApi` - authenticated share-management under `/api/shares`
  - `PublicSharingApi` - unauthenticated public surface used by the
*/

import { BACKEND_BASE } from "../statics";
import type {
  CreateShareEndpointReply,
  CreateShareEndpointRequest,
  DeleteSharesEndpointReply,
  DeleteSharesEndpointRequest,
  GetShareByIdEndpointReply,
  GetShareByIdEndpointRequest,
  GetSharesByIdEndpointReply,
  GetSharesByIdEndpointRequest,
  GetSharesEndpointReply,
  GetSharesEndpointRequest,
  UpdateShareEndpointReply,
  UpdateShareEndpointRequest,
} from "./models/sharing";
import type {
  GetPublicShareEndpointReply,
  GetPublicShareEndpointRequest,
  PostPublicAccessTokenReply,
} from "./models/publicSharing";
import { requestJson, toQueryString } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export interface SharingApi {
  /**
   * Create one share.
   *
   * The request body is forwarded to the backend as JSON.
   */
  createShare(
    request: CreateShareEndpointRequest,
  ): Promise<CreateShareEndpointReply>;

  /**
   * Update one share.
   *
   * The request body is forwarded to the backend as JSON.
   */
  updateShare(
    request: UpdateShareEndpointRequest,
  ): Promise<UpdateShareEndpointReply>;

  /**
   * Fetch shares by exact IDs.
   *
   * The backend returns all matching shares for the provided IDs.
   */
  getSharesById(
    request: GetSharesByIdEndpointRequest,
  ): Promise<GetSharesByIdEndpointReply>;

  /**
   * Fetch shares by filter.
   *
   * Any omitted filter field is ignored by the backend.
   */
  getShares(request: GetSharesEndpointRequest): Promise<GetSharesEndpointReply>;

  /**
   * Delete shares by exact IDs.
   *
   * The request is sent as JSON and the method resolves once the backend
   * accepts it.
   */
  deleteShares(
    request: DeleteSharesEndpointRequest,
  ): Promise<DeleteSharesEndpointReply>;

  /**
   * Fetch one share by ID.
   *
   * The backend returns the matching share or throws an error when the
   * share is missing.
   */
  getShareById(
    request: GetShareByIdEndpointRequest,
  ): Promise<GetShareByIdEndpointReply>;
}

export abstract class AbstractSharingApi implements SharingApi {
  abstract createShare(
    request: CreateShareEndpointRequest,
  ): Promise<CreateShareEndpointReply>;
  abstract updateShare(
    request: UpdateShareEndpointRequest,
  ): Promise<UpdateShareEndpointReply>;
  abstract getSharesById(
    request: GetSharesByIdEndpointRequest,
  ): Promise<GetSharesByIdEndpointReply>;
  abstract getShares(
    request: GetSharesEndpointRequest,
  ): Promise<GetSharesEndpointReply>;
  abstract deleteShares(
    request: DeleteSharesEndpointRequest,
  ): Promise<DeleteSharesEndpointReply>;
  abstract getShareById(
    request: GetShareByIdEndpointRequest,
  ): Promise<GetShareByIdEndpointReply>;
}

export class RestSharingApi extends AbstractSharingApi {
  async createShare(
    request: CreateShareEndpointRequest,
  ): Promise<CreateShareEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shares`;
    return await requestJson<CreateShareEndpointReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.share),
    });
  }

  async updateShare(
    request: UpdateShareEndpointRequest,
  ): Promise<UpdateShareEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shares`;
    return await requestJson<UpdateShareEndpointReply>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.share),
    });
  }

  async getSharesById(
    request: GetSharesByIdEndpointRequest,
  ): Promise<GetSharesByIdEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shares/by-id${toQueryString({ share_ids: request.share_ids })}`;
    return await requestJson<GetSharesByIdEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async getShares(
    request: GetSharesEndpointRequest,
  ): Promise<GetSharesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shares${toQueryString(request)}`;
    return await requestJson<GetSharesEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async deleteShares(
    request: DeleteSharesEndpointRequest,
  ): Promise<DeleteSharesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shares`;
    await requestJson<void>(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return;
  }

  async getShareById(
    request: GetShareByIdEndpointRequest,
  ): Promise<GetShareByIdEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/shares/${encodeURIComponent(request.id)}`;
    return await requestJson<GetShareByIdEndpointReply>(endpoint, {
      method: "GET",
    });
  }
}

export const sharingApi: SharingApi = new RestSharingApi();

// Also register the concrete REST singleton under a typed token so consumers
// can resolve it via `getSharingApi()`. The bare `sharingApi` export above
// stays for backward compatibility with existing call sites.
apiRegistry.register(sharingApi as RestSharingApi);
export const SHARING_API_TOKEN: ApiToken<RestSharingApi> = Symbol(
  "RestSharingApi",
) as ApiToken<RestSharingApi>;
apiRegistry.register(sharingApi as RestSharingApi, SHARING_API_TOKEN);

/**
 * Resolve the registered `RestSharingApi` singleton.
 *
 * Throws if the API isn't registered - see `getNoteApi` for rationale.
 */
export function getSharingApi(): RestSharingApi {
  return apiRegistry.get<RestSharingApi>(SHARING_API_TOKEN);
}

// ---------- Public (unauthenticated) share grant + JWT API ----------

/**
 * The public, unauthenticated share surface.
 *
 * Used by the public-note page to (1) resolve a share ID to the
 * underlying note + permission and (2) mint a JWT to authenticate
 * against Hocuspocus + the note REST API. No user cookies are sent
 * on these calls - the share ID is the grant.
 */
export interface PublicSharingApi {
  /**
   * Fetch the public, unauthenticated view of a share by its ID.
   *
   * Hits `GET /api/shares/public/?share_id=...`. The response
   * describes which note is shared, the granted access level
   * (`permission`), and the active time window during which the
   * share is valid.
   */
  getPublicShare(
    request: GetPublicShareEndpointRequest,
  ): Promise<GetPublicShareEndpointReply>;

  /**
   * Fetch a JWT for anonymous public-share access.
   *
   * Hits `POST /api/auth/public-access-token` with body `{ share_id }`.
   * Unauthenticated by design - the share ID IS the grant. Stored in
   * `useAuthStore.shareAccessToken` and forwarded as
   * `Authorization: Bearer <token>` by APIs that extend the
   * `ShareTokenBearer` mixin.
   */
  fetchPublicAccessToken(shareId: string): Promise<PostPublicAccessTokenReply>;
}

export abstract class AbstractPublicSharingApi implements PublicSharingApi {
  abstract getPublicShare(
    request: GetPublicShareEndpointRequest,
  ): Promise<GetPublicShareEndpointReply>;
  abstract fetchPublicAccessToken(
    shareId: string,
  ): Promise<PostPublicAccessTokenReply>;
}

export class RestPublicSharingApi extends AbstractPublicSharingApi {
  async getPublicShare(
    request: GetPublicShareEndpointRequest,
  ): Promise<GetPublicShareEndpointReply> {
    // Trailing slash matches the Go route (`shares.GET("/public/", ...)`).
    // Hitting `/api/shares?share_id=...` would 400/404 - that's the
    // authenticated list and rejects `share_id` as a filter.
    // `credentials: "omit"` keeps a stale session cookie from leaking
    // identity on this unauthenticated route.
    const endpoint = `${BACKEND_BASE}/api/shares/public/${toQueryString({
      share_id: request.share_id,
    })}`;
    return await requestJson<GetPublicShareEndpointReply>(endpoint, {
      method: "GET",
      credentials: "omit",
    });
  }

  async fetchPublicAccessToken(
    shareId: string,
  ): Promise<PostPublicAccessTokenReply> {
    const endpoint = `${BACKEND_BASE}/api/auth/public-access-token`;
    return await requestJson<PostPublicAccessTokenReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_id: shareId }),
      // Unauthenticated - omit the cookie to avoid leaking identity.
      credentials: "omit",
    });
  }
}

export const publicSharingApi: PublicSharingApi = new RestPublicSharingApi();

// Register the concrete REST singleton under a typed token so consumers
// can resolve it via `getPublicSharingApi()`. The bare `publicSharingApi`
// export above stays for backward compatibility.
apiRegistry.register(publicSharingApi as RestPublicSharingApi);
export const PUBLIC_SHARING_API_TOKEN: ApiToken<RestPublicSharingApi> = Symbol(
  "RestPublicSharingApi",
) as ApiToken<RestPublicSharingApi>;
apiRegistry.register(
  publicSharingApi as RestPublicSharingApi,
  PUBLIC_SHARING_API_TOKEN,
);

/**
 * Resolve the registered `RestPublicSharingApi` singleton.
 *
 * Throws if the API isn't registered - see `getNoteApi` for rationale.
 */
export function getPublicSharingApi(): RestPublicSharingApi {
  return apiRegistry.get<RestPublicSharingApi>(PUBLIC_SHARING_API_TOKEN);
}
