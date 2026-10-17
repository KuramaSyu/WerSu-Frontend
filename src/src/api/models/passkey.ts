/**
 * Passkey / WebAuthn ceremony types.
 *
 * Wire shape mirrors the Go controller types in `controllers.Passkey*`.
 * The `/finish` bodies forward the raw `PublicKeyCredential` produced by
 * `navigator.credentials.{create,get}()`: binary buffers travel as
 * base64url strings (no padding) because the backend library parses
 * them with `base64.RawURLEncoding`. SPA-side encoding lives in
 * `usePasskeyCeremony`.
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
 * WebAuthn transport hint surfaced on the attestation response.
 * Mirrors the W3C `AuthenticatorTransport` enum; typed inline so the
 * wire shape doesn't depend on which `lib.dom.d.ts` the project ships.
 */
export type AuthenticatorTransport =
  | "usb"
  | "nfc"
  | "ble"
  | "internal"
  | "hybrid"
  | "smart-card"
  | "cable";

/**
 * WebAuthn authenticator attachment hint surfaced on
 * `PublicKeyCredential.authenticatorAttachment`. Some browsers
 * (notably Safari) report `null`; the wire shape preserves that.
 */
export type AuthenticatorAttachment = "platform" | "cross-platform";

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
  /**
   * Server-issued 16-byte nonce that keys the ceremony between
   * `/begin` and `/finish`
   */
  session_key: string;
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
 * Body of the `credential` block on a `PasskeyCeremonyFinishRequest`.
 *
 * Mirrors the `PublicKeyCredential` the browser hands back from
 * `navigator.credentials.{create,get}()`: the backend library
 * (`go-webauthn`) parses this exact shape, so we forward it as-is
 * instead of flattening it. Binary buffers are base64url-encoded
 * (no padding) so `JSON.stringify` doesn't drop them.
 *
 * Attestation case (register / link): populate `attestationObject`
 * and `transports`. Assertion case (login): populate
 * `authenticatorData`, `signature`, and optionally `userHandle`.
 */
export interface FinishRequestCredential {
  /** Browser-reported credential id; opaque, used for UX correlation. */
  id: string;
  /** Base64url-encoded `rawId` (matches the `id` semantically). */
  rawId: string;
  type: "public-key";
  response: {
    /** Base64url-encoded `clientDataJSON` from the authenticator. */
    clientDataJSON: string;
    /** Attestation case: CBOR-encoded attestation object. */
    attestationObject?: string;
    /** Attestation case: transport hints surfaced by the platform. */
    transports?: AuthenticatorTransport[];
    /** Assertion case: `authenticatorData` from the assertion. */
    authenticatorData?: string;
    /** Assertion case: signature over `authenticatorData + clientDataJSON`. */
    signature?: string;
    /** Assertion case: user handle for discoverable credentials; absent when null. */
    userHandle?: string;
  };
  /** Browser-reported attachment hint; absent when null (e.g. Safari). */
  authenticatorAttachment?: AuthenticatorAttachment;
  /** Browser-reported client extension outputs. */
  clientExtensionResults?: Record<string, unknown>;
}

/**
 * WebAuthn attestation / assertion response sent to the matching
 * `finish` endpoint. The `credential` block is the raw
 * `PublicKeyCredential` from the browser; the backend parses it
 * directly (see `go-webauthn/webauthn`'s `ParseCredentialCreationResponse`
 * / `ParseCredentialAssertionResponse`). Binary buffers inside are
 * base64url-encoded strings (no padding).
 */
export interface PasskeyCeremonyFinishRequest {
  /**
   * Echo of the `session_key` returned by the matching `/begin` call.
   * The backend uses it to resolve the in-flight `webauthn.SessionData`
   * that `/begin` stored; without it `takeCeremony` 400s with
   * "ceremony not found". Always required for every finish
   * (register / login / link).
   */
  session_key: string;
  /** Optional UX label; backend passes it through to `AuthService.RegisterPasskey`. */
  friendly_name?: string;
  /** Raw `PublicKeyCredential` from the browser. */
  credential: FinishRequestCredential;
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
