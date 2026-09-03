/*
  Role REST client for the GoToHell API.

  Mirrors the `/api/roles` surface defined in
  `WerSuDeF-Rest-Api/src/docs/swagger.json`. The shape follows
  the same `AbstractRoleApi` / `RestRoleApi` split used by
  `SharingApi`: tests can swap the implementation without
  touching the call sites, and `requestJson` handles error
  parsing uniformly.

  Notes:
  - `POST /api/roles` requires the caller to be in the
    super-admin env-var list on the backend.
  - `DELETE /api/roles/:id` and the membership mutations
    require the caller to hold `manage` on the role. The
    frontend does not gate this; the backend returns 403 when
    the caller is unauthorised.
*/

import { BACKEND_BASE } from "../statics";
import type {
  AddUserToRoleEndpointReply,
  AddUserToRoleEndpointRequest,
  CreateRoleEndpointReply,
  CreateRoleEndpointRequest,
  DeleteRoleEndpointRequest,
  GetRoleByIdEndpointReply,
  GetRoleByIdEndpointRequest,
  GetRolesByUserEndpointReply,
  GetRolesByUserEndpointRequest,
  ListRoleMembersEndpointReply,
  ListRoleMembersEndpointRequest,
  ListRolesEndpointReply,
  ListRolesEndpointRequest,
  RemoveUserFromRoleEndpointRequest,
  UpdateRoleEndpointReply,
  UpdateRoleEndpointRequest,
} from "./models/role";
import { requestJson, toQueryString } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";

/**
 * REST surface for the authenticated role-management endpoints.
 * Implementation lives in :class:`RestRoleApi`; tests and
 * plugin code can pass an alternative implementation through
 * the registry.
 */
export interface RoleApi {
  /** List roles with optional filters. */
  listRoles(request: ListRolesEndpointRequest): Promise<ListRolesEndpointReply>;

  /** Fetch a single role by ID. */
  getRoleById(
    request: GetRoleByIdEndpointRequest,
  ): Promise<GetRoleByIdEndpointReply>;

  /** Create one role. Super-admin only on the backend. */
  createRole(
    request: CreateRoleEndpointRequest,
  ): Promise<CreateRoleEndpointReply>;

  /** Update one role. Caller must hold `manage` on the role. */
  updateRole(
    request: UpdateRoleEndpointRequest,
  ): Promise<UpdateRoleEndpointReply>;

  /** Delete one role. Caller must hold `manage` on the role. */
  deleteRole(request: DeleteRoleEndpointRequest): Promise<void>;

  /** List every role a user is a member of. */
  getRolesByUser(
    request: GetRolesByUserEndpointRequest,
  ): Promise<GetRolesByUserEndpointReply>;

  /** List every user that is a member of a role. */
  listRoleMembers(
    request: ListRoleMembersEndpointRequest,
  ): Promise<ListRoleMembersEndpointReply>;

  /** Add a user as a member of a role. */
  addUserToRole(
    request: AddUserToRoleEndpointRequest,
  ): Promise<AddUserToRoleEndpointReply>;

  /** Remove a user from a role's membership. */
  removeUserFromRole(
    request: RemoveUserFromRoleEndpointRequest,
  ): Promise<void>;
}

export abstract class AbstractRoleApi implements RoleApi {
  abstract listRoles(
    request: ListRolesEndpointRequest,
  ): Promise<ListRolesEndpointReply>;
  abstract getRoleById(
    request: GetRoleByIdEndpointRequest,
  ): Promise<GetRoleByIdEndpointReply>;
  abstract createRole(
    request: CreateRoleEndpointRequest,
  ): Promise<CreateRoleEndpointReply>;
  abstract updateRole(
    request: UpdateRoleEndpointRequest,
  ): Promise<UpdateRoleEndpointReply>;
  abstract deleteRole(request: DeleteRoleEndpointRequest): Promise<void>;
  abstract getRolesByUser(
    request: GetRolesByUserEndpointRequest,
  ): Promise<GetRolesByUserEndpointReply>;
  abstract listRoleMembers(
    request: ListRoleMembersEndpointRequest,
  ): Promise<ListRoleMembersEndpointReply>;
  abstract addUserToRole(
    request: AddUserToRoleEndpointRequest,
  ): Promise<AddUserToRoleEndpointReply>;
  abstract removeUserFromRole(
    request: RemoveUserFromRoleEndpointRequest,
  ): Promise<void>;
}

export class RestRoleApi extends AbstractRoleApi {
  async listRoles(
    request: ListRolesEndpointRequest,
  ): Promise<ListRolesEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/roles${toQueryString(request)}`;
    return await requestJson<ListRolesEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async getRoleById(
    request: GetRoleByIdEndpointRequest,
  ): Promise<GetRoleByIdEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/roles/${encodeURIComponent(request.id)}`;
    return await requestJson<GetRoleByIdEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async createRole(
    request: CreateRoleEndpointRequest,
  ): Promise<CreateRoleEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/roles`;
    return await requestJson<CreateRoleEndpointReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async updateRole(
    request: UpdateRoleEndpointRequest,
  ): Promise<UpdateRoleEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/roles/${encodeURIComponent(request.id)}`;
    return await requestJson<UpdateRoleEndpointReply>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
  }

  async deleteRole(request: DeleteRoleEndpointRequest): Promise<void> {
    const endpoint = `${BACKEND_BASE}/api/roles/${encodeURIComponent(request.id)}`;
    await requestJson<void>(endpoint, {
      method: "DELETE",
    });
  }

  async getRolesByUser(
    request: GetRolesByUserEndpointRequest,
  ): Promise<GetRolesByUserEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/roles/by-user${toQueryString({
      subject_user_id: request.subject_user_id,
    })}`;
    return await requestJson<GetRolesByUserEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async listRoleMembers(
    request: ListRoleMembersEndpointRequest,
  ): Promise<ListRoleMembersEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/roles/members${toQueryString({
      role_id: request.role_id,
    })}`;
    return await requestJson<ListRoleMembersEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async addUserToRole(
    request: AddUserToRoleEndpointRequest,
  ): Promise<AddUserToRoleEndpointReply> {
    const endpoint = `${BACKEND_BASE}/api/roles/members`;
    return await requestJson<AddUserToRoleEndpointReply>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }

  async removeUserFromRole(
    request: RemoveUserFromRoleEndpointRequest,
  ): Promise<void> {
    const endpoint = `${BACKEND_BASE}/api/roles/members`;
    await requestJson<void>(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  }
}

export const roleApi: RoleApi = new RestRoleApi();

// Register the concrete REST singleton under a typed token so consumers
// can resolve it via `getRoleApi()`. The bare `roleApi` export above
// stays for backward compatibility with the rest of the call sites.
apiRegistry.register(roleApi as RestRoleApi);
export const ROLE_API_TOKEN: ApiToken<RestRoleApi> = Symbol(
  "RestRoleApi",
) as ApiToken<RestRoleApi>;
apiRegistry.register(roleApi as RestRoleApi, ROLE_API_TOKEN);

/**
 * Resolve the registered `RestRoleApi` singleton.
 *
 * Throws if the API isn't registered - see `getNoteApi` for rationale.
 */
export function getRoleApi(): RestRoleApi {
  return apiRegistry.get<RestRoleApi>(ROLE_API_TOKEN);
}
