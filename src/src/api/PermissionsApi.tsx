import { BACKEND_BASE } from "../statics";
import type {
  CreatePermissionBody,
  DeletePermissionBody,
  PermissionObjectQueryType,
  PermissionsReply,
  ReplacePermissionsBody,
} from "./models/search";
import { requestJson, toQueryString } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";

export type { PermissionObjectQueryType };

export interface IPermissionsApi {
  get(
    object_type: PermissionObjectQueryType,
    object_id: string,
  ): Promise<PermissionsReply>;
  put(payload: ReplacePermissionsBody): Promise<PermissionsReply>;
  post(payload: CreatePermissionBody): Promise<PermissionsReply>;
  delete(payload: DeletePermissionBody): Promise<PermissionsReply>;
}

const PERMISSIONS_ENDPOINT = `${BACKEND_BASE}/api/permissions`;

/**
 * REST client for `/api/permissions`.
 *
 * Mutations return the full permission set for the target object, so
 * callers can update a local cache or simply invalidate the query.
 */
export class PermissionsApi implements IPermissionsApi {
  async get(
    object_type: PermissionObjectQueryType,
    object_id: string,
  ): Promise<PermissionsReply> {
    return await requestJson<PermissionsReply>(
      `${PERMISSIONS_ENDPOINT}${toQueryString({ object_type, object_id })}`,
      { method: "GET" },
    );
  }

  async put(payload: ReplacePermissionsBody): Promise<PermissionsReply> {
    return await this.requestWithBody("PUT", payload);
  }

  async post(payload: CreatePermissionBody): Promise<PermissionsReply> {
    return await this.requestWithBody("POST", payload);
  }

  async delete(payload: DeletePermissionBody): Promise<PermissionsReply> {
    return await this.requestWithBody("DELETE", payload);
  }

  private async requestWithBody(
    method: "PUT" | "POST" | "DELETE",
    payload:
      ReplacePermissionsBody | CreatePermissionBody | DeletePermissionBody,
  ): Promise<PermissionsReply> {
    return await requestJson<PermissionsReply>(PERMISSIONS_ENDPOINT, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }
}

// Register the default singleton + a typed token so consumers can resolve
// it via `getPermissionsApi()`.
//
// IMPORTANT: broadcast-set + typed-token must be the SAME instance.
// See NoteApi for the bug history.
const permissionsApiSingleton = new PermissionsApi();
apiRegistry.register(permissionsApiSingleton);
export const PERMISSIONS_API_TOKEN: ApiToken<PermissionsApi> = Symbol(
  "PermissionsApi",
) as ApiToken<PermissionsApi>;
apiRegistry.register(permissionsApiSingleton, PERMISSIONS_API_TOKEN);

/**
 * Resolve the registered `PermissionsApi` singleton.
 *
 * Throws if the API isn't registered — see `getNoteApi` for rationale.
 */
export function getPermissionsApi(): PermissionsApi {
  return apiRegistry.get<PermissionsApi>(PERMISSIONS_API_TOKEN);
}
