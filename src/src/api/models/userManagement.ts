// Wire shapes for the user-management REST surface.

export type { JsUserAuth } from "./passkey";

/** POST /api/users body. Admin or import path; success does NOT set a session cookie. */
export interface PostUserRequest {
  email: string;
  username: string;
  /** Plaintext password. */
  password: string;
}

/** POST /api/auth/signup body. User-facing; success sets a session cookie. */
export interface SignupRequest {
  username: string;
  email: string;
  /** Plaintext password. */
  password: string;
}

/** POST /api/auth/login body for the password path. */
export interface LoginPasswordRequest {
  kind: "password";
  email: string;
  /** Plaintext password. */
  password: string;
}

/** PATCH /api/users/{id} body. Tri-state per field. */
export interface PatchUserRequest {
  username?: string;
  username_clear?: boolean;
  email?: string;
  email_clear?: boolean;
  avatar_url?: string;
  avatar_url_clear?: boolean;
}

/** POST /api/auth/password/change body. Both fields are plaintext. */
export interface ChangePasswordRequest {
  /**
   * Current plaintext password. Omit when no password is set on the
   * account yet (e.g. Discord-only sign-up) — the server then treats
   * the call as a set-password.
   */
  current?: string;
  /** Avoids the TS `new` reserved word while staying snake_case on the wire. */
  new_password: string;
}

/** Throw when a PATCH sets the same field as it also marks for clear. */
export function assertPatchNoConflict(req: PatchUserRequest): void {
  const pairs: Array<
    [string, string | boolean | undefined, string | boolean | undefined]
  > = [
    ["username", req.username, req.username_clear],
    ["email", req.email, req.email_clear],
    ["avatar_url", req.avatar_url, req.avatar_url_clear],
  ];
  for (const [field, setValue, clearValue] of pairs) {
    if (setValue !== undefined && clearValue === true) {
      throw new Error(
        `PatchUserRequest: ${field} and ${field}_clear are mutually exclusive`,
      );
    }
  }
}
