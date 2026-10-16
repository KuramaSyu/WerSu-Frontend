// REST client for the user-management surface.

import { BACKEND_BASE } from "../statics";
import { requestJson } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";
import type { JsUserAuth } from "./models/passkey";
import {
  assertPatchNoConflict,
  type ChangePasswordRequest,
  type LoginPasswordRequest,
  type PatchUserRequest,
  type PostUserRequest,
  type SignupRequest,
} from "./models/userManagement";

/** Interface for the user-management REST endpoints. */
export interface IUserManagementApi {
  /** POST /api/users (admin or import; no session cookie set on success) */
  createUser(payload: PostUserRequest): Promise<JsUserAuth>;

  /** POST /api/auth/signup (user-facing; sets session cookie) */
  signup(payload: SignupRequest): Promise<JsUserAuth>;

  /** POST /api/auth/login (user-facing; sets session cookie) */
  loginPassword(payload: LoginPasswordRequest): Promise<JsUserAuth>;

  /** PATCH /api/users/{id} (self or admin; tri-state per field) */
  patchUser(id: string, payload: PatchUserRequest): Promise<JsUserAuth>;

  /** POST /api/auth/password/change (self) */
  changePassword(payload: ChangePasswordRequest): Promise<void>;
}

export class UserManagementApi implements IUserManagementApi {
  async createUser(payload: PostUserRequest): Promise<JsUserAuth> {
    return await requestJson<JsUserAuth>(`${BACKEND_BASE}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async signup(payload: SignupRequest): Promise<JsUserAuth> {
    return await requestJson<JsUserAuth>(`${BACKEND_BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async loginPassword(payload: LoginPasswordRequest): Promise<JsUserAuth> {
    return await requestJson<JsUserAuth>(`${BACKEND_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async patchUser(id: string, payload: PatchUserRequest): Promise<JsUserAuth> {
    assertPatchNoConflict(payload);
    return await requestJson<JsUserAuth>(`${BACKEND_BASE}/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async changePassword(payload: ChangePasswordRequest): Promise<void> {
    await requestJson<void>(`${BACKEND_BASE}/api/auth/password/change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
}

const userManagementApiSingleton = new UserManagementApi();
apiRegistry.register(userManagementApiSingleton);
export const USER_MANAGEMENT_API_TOKEN: ApiToken<UserManagementApi> = Symbol(
  "UserManagementApi",
) as ApiToken<UserManagementApi>;
apiRegistry.register(userManagementApiSingleton, USER_MANAGEMENT_API_TOKEN);

/** Resolve the registered UserManagementApi singleton. */
export function getUserManagementApi(): UserManagementApi {
  return apiRegistry.get<UserManagementApi>(USER_MANAGEMENT_API_TOKEN);
}
