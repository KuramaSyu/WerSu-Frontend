/*
 * Passkey / WebAuthn REST client for the GoToHell API.
 *
 * Three ceremony surfaces + a small management surface:
 *
 *   - register     POST /auth/passkey/register/{begin,finish}
 *                   Unauthenticated. Creates a new account + first passkey.
 *   - login        POST /auth/passkey/login/{begin,finish}
 *                   Unauthenticated. Resolves to a logged-in session.
 *   - link         POST /auth/link/passkey/{begin,finish}
 *                   Authenticated. Attaches an additional passkey to the
 *                   currently signed-in user.
 *   - list         GET  /auth/passkey/list[?include_revoked=true]
 *                   Authenticated. Lists the caller's passkeys; revoked
 *                   rows are excluded unless `include_revoked=true`.
 *   - revoke       DELETE /auth/passkey/{id}
 *                   Authenticated. Revokes one of the caller's passkeys;
 *                   cross-user IDs return 404 so existence is not leaked.
 *
 * The `link`/`list`/`revoke` endpoints require the existing session
 * cookie and are routed through the shared `requestJson` helper so the
 * share-token provider (`.setShareTokenProvider`) can be installed on
 * the API without touching the call sites.
 */

import { BACKEND_BASE } from "../statics";
import { toQueryString, requestJson } from "./utils/request_helpers";
import { apiRegistry, type ApiToken } from "./apiRegistry";
import type {
  JsUserAuth,
  ListPasskeysEndpointReply,
  ListPasskeysEndpointRequest,
  PasskeyCeremonyBeginReply,
  PasskeyCeremonyBeginRequest,
  PasskeyCeremonyFinishReply,
  PasskeyCeremonyFinishRequest,
  RevokePasskeyEndpointRequest,
} from "./models/passkey";

/**
 * Endpoint surface for the passkey / WebAuthn ceremonies.
 *
 * Each method maps to a single REST route and takes the wire-shape
 * payload directly; the browser-side `PublicKeyCredential` decode/encode
 * lives in `usePasskeyCeremony` so the API stays a thin transport.
 */
export interface PasskeyApi {
  /** Starts a passkey registration ceremony for a new user. */
  registerBegin(
    request?: PasskeyCeremonyBeginRequest,
  ): Promise<PasskeyCeremonyBeginReply>;

  /** Completes a passkey registration ceremony. */
  registerFinish(
    request: PasskeyCeremonyFinishRequest,
  ): Promise<PasskeyCeremonyFinishReply>;

  /**
   * Starts a passkey assertion (login) ceremony. No body - the server
   * generates a fresh challenge for discoverable credentials.
   */
  loginBegin(): Promise<PasskeyCeremonyBeginReply>;

  /**
   * Completes a passkey assertion. On success the backend sets the
   * session cookie and returns the canonical user payload.
   */
  loginFinish(request: PasskeyCeremonyFinishRequest): Promise<JsUserAuth>;

  /** Starts a passkey-link ceremony for the already-authenticated user. */
  linkBegin(): Promise<PasskeyCeremonyBeginReply>;

  /** Completes a passkey-link ceremony for the already-authenticated user. */
  linkFinish(
    request: PasskeyCeremonyFinishRequest,
  ): Promise<PasskeyCeremonyFinishReply>;

  /**
   * Lists the caller's passkeys. Revoked rows are excluded unless
   * `request.include_revoked` is true.
   */
  listPasskeys(
    request?: ListPasskeysEndpointRequest,
  ): Promise<ListPasskeysEndpointReply>;

  /** Revokes one of the caller's passkeys by id. */
  revokePasskey(request: RevokePasskeyEndpointRequest): Promise<void>;
}

export abstract class AbstractPasskeyApi implements PasskeyApi {
  abstract registerBegin(
    request?: PasskeyCeremonyBeginRequest,
  ): Promise<PasskeyCeremonyBeginReply>;
  abstract registerFinish(
    request: PasskeyCeremonyFinishRequest,
  ): Promise<PasskeyCeremonyFinishReply>;
  abstract loginBegin(): Promise<PasskeyCeremonyBeginReply>;
  abstract loginFinish(
    request: PasskeyCeremonyFinishRequest,
  ): Promise<JsUserAuth>;
  abstract linkBegin(): Promise<PasskeyCeremonyBeginReply>;
  abstract linkFinish(
    request: PasskeyCeremonyFinishRequest,
  ): Promise<PasskeyCeremonyFinishReply>;
  abstract listPasskeys(
    request?: ListPasskeysEndpointRequest,
  ): Promise<ListPasskeysEndpointReply>;
  abstract revokePasskey(
    request: RevokePasskeyEndpointRequest,
  ): Promise<void>;
}

/**
 * Wire-level REST client. Extends `ShareTokenBearerMixin` so a future
 * share-token passkey config (e.g. share-gated passkey link) can install
 * a bearer without touching the call sites.
 */
export class RestPasskeyApi extends AbstractPasskeyApi {
  async registerBegin(
    request: PasskeyCeremonyBeginRequest = {},
  ): Promise<PasskeyCeremonyBeginReply> {
    return await requestJson<PasskeyCeremonyBeginReply>(
      `${BACKEND_BASE}/api/auth/passkey/register/begin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
    );
  }

  async registerFinish(
    request: PasskeyCeremonyFinishRequest,
  ): Promise<PasskeyCeremonyFinishReply> {
    return await requestJson<PasskeyCeremonyFinishReply>(
      `${BACKEND_BASE}/api/auth/passkey/register/finish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
    );
  }

  async loginBegin(): Promise<PasskeyCeremonyBeginReply> {
    return await requestJson<PasskeyCeremonyBeginReply>(
      `${BACKEND_BASE}/api/auth/passkey/login/begin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async loginFinish(
    request: PasskeyCeremonyFinishRequest,
  ): Promise<JsUserAuth> {
    return await requestJson<JsUserAuth>(
      `${BACKEND_BASE}/api/auth/passkey/login/finish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
    );
  }

  async linkBegin(): Promise<PasskeyCeremonyBeginReply> {
    return await requestJson<PasskeyCeremonyBeginReply>(
      `${BACKEND_BASE}/api/auth/link/passkey/begin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  async linkFinish(
    request: PasskeyCeremonyFinishRequest,
  ): Promise<PasskeyCeremonyFinishReply> {
    return await requestJson<PasskeyCeremonyFinishReply>(
      `${BACKEND_BASE}/api/auth/link/passkey/finish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
    );
  }

  async listPasskeys(
    request: ListPasskeysEndpointRequest = {},
  ): Promise<ListPasskeysEndpointReply> {
    // Only serialize include_revoked when it's explicitly true; the
    // server defaults to false (revoked rows excluded) so an absent
    // query param is identical to ?include_revoked=false.
    const params: ListPasskeysEndpointRequest = {};
    if (request.include_revoked) params.include_revoked = true;
    const endpoint = `${BACKEND_BASE}/api/auth/passkey/list${toQueryString(
      params,
    )}`;
    return await requestJson<ListPasskeysEndpointReply>(endpoint, {
      method: "GET",
    });
  }

  async revokePasskey(
    request: RevokePasskeyEndpointRequest,
  ): Promise<void> {
    await requestJson<void>(
      `${BACKEND_BASE}/api/auth/passkey/${encodeURIComponent(request.id)}`,
      { method: "DELETE" },
    );
  }
}

/**
 * Singleton instance. Registered under both the broadcast-set and a
 * typed token so callers can resolve it via `getPasskeyApi()`.
 */
export const passkeyApi: PasskeyApi = new RestPasskeyApi();
apiRegistry.register(passkeyApi);
export const PASSKEY_API_TOKEN: ApiToken<RestPasskeyApi> = Symbol(
  "RestPasskeyApi",
) as ApiToken<RestPasskeyApi>;
apiRegistry.register(passkeyApi as RestPasskeyApi, PASSKEY_API_TOKEN);

/**
 * Resolve the registered `RestPasskeyApi` singleton.
 *
 * Throws if the API isn't registered - mirrors the registration contract
 * used by `getNoteApi`, `getUserApi`, `getSharingApi`.
 */
export function getPasskeyApi(): RestPasskeyApi {
  return apiRegistry.get<RestPasskeyApi>(PASSKEY_API_TOKEN);
}
