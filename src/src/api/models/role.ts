/**
 * Role types - request/response shapes for the authenticated
 * role-management REST endpoints mounted under `/api/roles`
 * (CRUD + membership). The role endpoint is admin-only on the
 * backend; `POST /api/roles` requires the caller to be in the
 * super-admin env-var list.
 */

/** Reply shape for a single role row returned by
 *  `GET /api/roles`, `GET /api/roles/:id`, `POST /api/roles`,
 *  and `PATCH /api/roles/:id`. */
export interface RoleReply {
  id: string;
  name?: string;
  description?: string;
  created_at?: string;
}

/** Body for `POST /api/roles`. Caller must hold the
 *  super-admin env-var list. */
export interface CreateRoleBody {
  name: string;
  description?: string;
}

/** Body for `PATCH /api/roles/:id`. Caller must hold `manage`
 *  on the role. Every field is optional. */
export interface UpdateRoleBody {
  name?: string;
  description?: string;
}

/** Query for `GET /api/roles`. Both fields are optional and
 *  combine with AND. `member_id` restricts to roles the given
 *  user belongs to. */
export interface ListRolesQuery {
  name?: string;
  member_id?: string;
}

/** Reply for `GET /api/roles/members` and the membership
 *  mutations. `granted_at` is the timestamp the membership edge
 *  was created. */
export interface UserRoleMembershipReply {
  user_id: string;
  role_id: string;
  granted_at?: string;
}

/** Body for `POST /api/roles/members` - add a user as a member
 *  of a role. Caller must hold `manage` on the role. */
export interface AddUserToRoleBody {
  role_id: string;
  subject_user_id: string;
}

/** Body for `DELETE /api/roles/members` - remove a user from a
 *  role's membership. Caller must hold `manage` on the role. */
export interface RemoveUserFromRoleBody {
  role_id: string;
  subject_user_id: string;
}

export type ListRolesEndpointRequest = ListRolesQuery;
export type ListRolesEndpointReply = RoleReply[];

export type GetRolesByUserEndpointRequest = { subject_user_id: string };
export type GetRolesByUserEndpointReply = RoleReply[];

export type CreateRoleEndpointRequest = CreateRoleBody;
export type CreateRoleEndpointReply = RoleReply;

export type GetRoleByIdEndpointRequest = { id: string };
export type GetRoleByIdEndpointReply = RoleReply;

export type UpdateRoleEndpointRequest = { id: string; body: UpdateRoleBody };
export type UpdateRoleEndpointReply = RoleReply;

export type DeleteRoleEndpointRequest = { id: string };
export type DeleteRoleEndpointReply = void;

export type ListRoleMembersEndpointRequest = { role_id: string };
export type ListRoleMembersEndpointReply = UserRoleMembershipReply[];

export type AddUserToRoleEndpointRequest = AddUserToRoleBody;
export type AddUserToRoleEndpointReply = UserRoleMembershipReply;

export type RemoveUserFromRoleEndpointRequest = RemoveUserFromRoleBody;
export type RemoveUserFromRoleEndpointReply = void;
