/*
  Sharing-only TanStack-friendly REST client for the GoToHell API.

  Design goals:
  - Keep the API surface swappable through an abstract class.
  - Keep sharing endpoint methods strongly typed.
  - Put the endpoint string at the beginning of each concrete method.
  - Throw on non-2xx responses so consumers can handle errors in TanStack query/mutation error boundaries.
  - Keep the backend base URL as an ambient global: BACKEND_BASE.
*/

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
import { requestJson, toQueryString } from "./utils/request_helpers";

declare const BACKEND_BASE: string;

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

// ---------- Shared utility helpers ----------

// ---------- Abstract API contract ----------

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
   * The request is sent as JSON and the method resolves once the backend accepts it.
   */
  deleteShares(
    request: DeleteSharesEndpointRequest,
  ): Promise<DeleteSharesEndpointReply>;

  /**
   * Fetch one share by ID.
   *
   * The backend returns the matching share or throws an error when the share is missing.
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
    const endpoint = `${BACKEND_BASE}/shares`;
    return await requestJson<CreateShareEndpointReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.share),
    });
  }

  async updateShare(
    request: UpdateShareEndpointRequest,
  ): Promise<UpdateShareEndpointReply> {
    const endpoint = `${BACKEND_BASE}/shares`;
    return await requestJson<UpdateShareEndpointReply>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.share),
    });
  }

  async getSharesById(
    request: GetSharesByIdEndpointRequest,
  ): Promise<GetSharesByIdEndpointReply> {
    const endpoint = `${BACKEND_BASE}/shares/by-id${toQueryString({ share_ids: request.share_ids })}`;
    return await requestJson<GetSharesByIdEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async getShares(
    request: GetSharesEndpointRequest,
  ): Promise<GetSharesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/shares${toQueryString(request)}`;
    return await requestJson<GetSharesEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async deleteShares(
    request: DeleteSharesEndpointRequest,
  ): Promise<DeleteSharesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/shares`;
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
    const endpoint = `${BACKEND_BASE}/shares/${encodeURIComponent(request.id)}`;
    return await requestJson<GetShareByIdEndpointReply>(endpoint, {
      method: "GET",
    });
  }
}

export const sharingApiClient: SharingApi = new RestSharingApi();
