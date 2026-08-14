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
