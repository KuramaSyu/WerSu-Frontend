/**
 * Passkey / WebAuthn ceremony types.
 *
 * Wire shape mirrors the Go controller types in `controllers.Passkey*`.
 * The binary fields (`client_data_json`, `authenticator_data`, `signature`,
 * `credential_id`) travel as `number[]` over JSON because the swagger
 * generator maps `[]byte` to int arrays; the browser provides them as
 * `ArrayBuffer` so the API client converts both directions.
 *
 * Routes covered:
 *   - POST /auth/passkey/register/begin  (unauthenticated)
 *   - POST /auth/passkey/register/finish (unauthenticated)
 *   - POST /auth/passkey/login/begin     (unauthenticated)
 *   - POST /auth/passkey/login/finish    (unauthenticated)
 *   - POST /auth/link/passkey/begin      (authenticated, links to current user)
 *   - POST /auth/link/passkey/finish     (authenticated, links to current user)
 *   - GET  /auth/passkey/list            (authenticated, lists own passkeys)
 *   - DELETE /auth/passkey/{id}          (authenticated, revoke one of own)
 */

/**
 * Server response for the start of any passkey ceremony.
 *
 * The actual `PublicKeyCredentialCreationOptions` / `PublicKeyCredentialRequestOptions`
 * document is regenerated client-side from these fields by the
 * `usePasskeyCeremony` hook.
 */
export interface PasskeyCeremonyBeginReply {
  challenge: string;
  rp_id: string;
  rp_name: string;
  timeout?: number;
  user_id?: string;
  user_name?: string;
}

/**
 * Optional hints for the registration-start endpoint. The backend accepts
 * an empty body for "register with a fresh challenge"; supply `username`
 * when the backend needs to seed the RP user.
 */
export interface PasskeyCeremonyBeginRequest {
  username?: string;
}

/**
 * WebAuthn attestation / assertion response sent to the matching
 * `finish` endpoint. Binary blobs are encoded as `number[]` to match
 * the swagger definition (Go `[]byte` -> JSON int array).
 */
export interface PasskeyCeremonyFinishRequest {
  credential_id: number[];
  client_data_json: number[];
  authenticator_data: number[];
  signature: number[];
  friendly_name?: string;
}

/**
 * Server reply for a successful registration. The backend returns the
 * credential ID so the client can correlate UX messages.
 */
export interface PasskeyCeremonyFinishReply {
  credential_id?: string;
}

/**
 * Body posted to `useUserStore` after a successful passkey login.
 * The backend sets the `discord_auth` session cookie just like the
 * Discord OAuth flow, so a `GET /api/auth/user` call picks up the
 * user without any extra plumbing.
 */
export interface JsUserAuth {
  id: string;
  username: string;
  email?: string;
  email_verified_at?: string;
  is_active: boolean;
  avatar_url?: string | null;
}

/**
 * One entry from `GET /auth/passkey/list`. The backend populates
 * `created_at` for every passkey; `friendly_name`, `last_used_at`,
 * and `revoked_at` are optional because the authenticator may not
 * have surfaced them at registration, the passkey may never have
 * been used, or (for the last one) it may still be active.
 */
export interface Passkey {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
}

/**
 * Query parameters for `GET /auth/passkey/list`. `include_revoked=true`
 * keeps revoked rows in the response so the user can audit what was
 * retired; the default hides them.
 */
export interface ListPasskeysEndpointRequest {
  include_revoked?: boolean;
}

/**
 * Response for `GET /auth/passkey/list`.
 */
export interface ListPasskeysEndpointReply {
  passkeys: Passkey[];
}

/**
 * No-body request for `DELETE /auth/passkey/{id}`. Reserved so the
 * mutation signature stays symmetric with the other delete hooks.
 */
export type RevokePasskeyEndpointRequest = { id: string };
