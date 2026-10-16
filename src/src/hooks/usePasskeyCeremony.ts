/*
 * WebAuthn ceremony driver.
 *
 * Bridges the backend's `begin`/`finish` endpoints with the browser's
 * `navigator.credentials.{create,get}` APIs. The backend returns a
 * flattened `PasskeyCeremonyBeginReply` (challenge + rp_id + rp_name +
 * user_id + user_name + timeout); this hook rehydrates it into a real
 * `PublicKeyCredentialCreationOptions` / `PublicKeyCredentialRequestOptions`
 * document, hands it to the platform authenticator, and serializes the
 * resulting `AuthenticatorAttestationResponse` / `AuthenticatorAssertionResponse`
 * into the wire shape the backend expects.
 *
 * Why this is a hook (not a plain function):
 *   - `useMutation` from TanStack gives us loading/error state for free.
 *   - The login flow needs to write the resulting user into
 *     `useUserStore` and invalidate the `["user"]` query so the rest
 *     of the app reconciles. A mutation is the natural place to do that.
 *
 * Wire-shape note:
 *   Per the swagger, the binary fields travel as `number[]` (Go `[]byte`
 *   -> JSON int array). `ArrayBuffer` -> `number[]` and back goes via
 *   `Uint8Array` for both directions.
 */

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { getPasskeyApi } from "../api/PasskeyApi";
import { useUserStore } from "../zustand/userStore";
import { useUser } from "../api/queries/useUser";
import { WersuUserImpl } from "../components/DiscordLogin";
import { queryClient } from "../api/queryClient";
import type {
  JsUserAuth,
  PasskeyCeremonyBeginReply,
  PasskeyCeremonyFinishReply,
  PasskeyCeremonyFinishRequest,
} from "../api/models/passkey";

/**
 * OPFS / WebAuthn unavailability is a runtime condition, not a build-time
 * one - older browsers lack `navigator.credentials` and Linux Firefox
 * often lacks a platform authenticator. Surface this explicitly so the
 * UI can show a useful message instead of a cryptic hydration error.
 */
export class WebAuthnUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebAuthnUnavailableError";
  }
}

const requireWebAuthn = (): void => {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !navigator.credentials ||
    typeof navigator.credentials.create !== "function" ||
    typeof navigator.credentials.get !== "function"
  ) {
    throw new WebAuthnUnavailableError(
      "WebAuthn is not supported in this browser. Try a different browser or device.",
    );
  }
};

/**
 * Decode base64url -> Uint8Array backed by a real `ArrayBuffer` (not
 * `SharedArrayBuffer`). The backend standard-encodes WebAuthn fields as
 * base64url strings (challenge, user_id); the browser expects
 * `BufferSource`, which in current lib.dom.d.ts narrows to
 * `ArrayBuffer`-backed views.
 */
const base64UrlToBytes = (input: string): Uint8Array<ArrayBuffer> => {
  // TS says string but a 200 reply can ship a partial body (no
  // challenge) when the server thinks passkey support is up but the
  // challenge generator bailed. Throw a neutral message instead of a
  // raw TypeError on input.replace; do NOT use the
  // "passkey support is not configured" prefix the controller uses
  // for the actual not-configured case, otherwise the Settings UI
  // would tell the user to set WEBAUTHN_RP_ID even though the server
  // just returned 200 OK.
  if (typeof input !== "string" || input.length === 0) {
    throw new Error(
      "Server reply missing challenge; passkey ceremony could not start.",
    );
  }
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const normalized = pad ? padded + "=".repeat(4 - pad) : padded;
  const binary = atob(normalized);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Turn the backend's `*Bytes` array into the `Uint8Array` the browser
 * wants. Inputs are JSON `number[]` (per the swagger spec).
 */
const bytesToUint8 = (
  input: number[] | Uint8Array,
): Uint8Array<ArrayBuffer> => {
  if (input instanceof Uint8Array) {
    // Re-pack into a fresh ArrayBuffer to drop any SharedArrayBuffer
    // backing the source may have.
    const buffer = new ArrayBuffer(input.byteLength);
    const view = new Uint8Array(buffer);
    view.set(input);
    return view;
  }
  const buffer = new ArrayBuffer(input.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < input.length; i++) {
    bytes[i] = input[i];
  }
  return bytes;
};

/**
 * Convert a `BufferSource` (typically `ArrayBuffer`) into the `number[]`
 * shape the backend expects in the finish request body.
 */
const bufferToByteArray = (input: ArrayBuffer): number[] =>
  Array.from(new Uint8Array(input));

/**
 * Lightweight `{id, name, displayName}` derived from the current user.
 * The link ceremony endpoint returns a challenge without `user_id` /
 * `user_name` because the server already knows the caller from the
 * session; the browser-side `user` block still has to be populated so
 * the authenticator can correlate the new credential with the existing
 * account. We pull that information from the live user store.
 *
 * Returns `undefined` when no user is loaded yet (e.g. on the cold-
 * start frame before `useUser` has resolved). In that case the caller
 * should fall back to the server-supplied fields; if neither source
 * has the data, `buildCreationOptions` throws.
 */
interface LinkUser {
  id: string;
  name: string;
  displayName?: string;
}

/**
 * Read the active user out of the zustand store. Prefers the live
 * react-query result (which writes back into `useUserStore` after a
 * successful fetch) because that is the canonical "who is logged in
 * right now" view. Returns `undefined` if nothing is hydrated.
 */
const resolveActiveUser = (): LinkUser | undefined => {
  const u = useUserStore.getState().user;
  if (u) {
    const id = u.id?.length > 0 ? u.id : u.username;
    if (id) {
      return {
        id,
        name: u.username || id,
        displayName: u.username || undefined,
      };
    }
  }
  // Fallback: the zustand store can be cleared momentarily while
  // react-query refetches; in that window we don't have a User object.
  return undefined;
};

/**
 * Build the `PublicKeyCredentialCreationOptions` document the browser
 * consumes during `navigator.credentials.create()`.
 *
 * The backend's `PasskeyCeremonyBeginReply` is the bare minimum needed
 * to identify the ceremony (challenge + rp). For a fresh registration
 * it also carries the `user_id` / `user_name` the RP needs to seed a
 * brand-new user record. For a link ceremony those fields are absent
 * because the session already identifies the caller — `fallbackUser`
 * is the optional in-app fallback populated from `useUserStore`.
 *
 * `forLink` toggles the error message: the link flow's "missing
 * user_id" is a UI/cache problem (we couldn't read the user), not a
 * backend problem. The register flow's "missing user_id" is genuinely
 * a server-side reply-shape issue.
 */
const buildCreationOptions = (
  reply: PasskeyCeremonyBeginReply,
  friendlyName: string | undefined,
  fallbackUser: LinkUser | undefined,
  forLink: boolean,
): PublicKeyCredentialCreationOptions => {
  const userId = reply.user_id ?? fallbackUser?.id;
  const userName = reply.user_name ?? fallbackUser?.name;
  if (!userId || !userName) {
    if (forLink) {
      // The logged-in user couldn't be resolved from the cache. Most
      // often this means `useUser` is still fetching (cold-start).
      // Surface it as a UI state, not a "server bug" message.
      throw new Error(
        "Couldn't read your account from the cache. Wait a moment and try again.",
      );
    }
    throw new Error(
      "Server response missing user_id/user_name; cannot start registration ceremony.",
    );
  }
  return {
    challenge: base64UrlToBytes(reply.challenge),
    rp: {
      id: reply.rp_id,
      name: reply.rp_name,
    },
    user: {
      id: base64UrlToBytes(userId),
      name: userName,
      // `displayName` falls back to the username; backend doesn't ship
      // a separate display name yet.
      displayName:
        friendlyName ??
        fallbackUser?.displayName ??
        reply.user_name ??
        userName,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      requireResidentKey: false,
    },
    timeout: reply.timeout ?? 60_000,
    attestation: "none",
  };
};

/**
 * Build the `PublicKeyCredentialRequestOptions` document for the login
 * ceremony. `allowCredentials` is intentionally omitted so discoverable
 * credentials (passkeys) work.
 */
const buildRequestOptions = (
  reply: PasskeyCeremonyBeginReply,
): PublicKeyCredentialRequestOptions => ({
  challenge: base64UrlToBytes(reply.challenge),
  rpId: reply.rp_id,
  timeout: reply.timeout ?? 60_000,
  userVerification: "preferred",
});

/**
 * Read the authenticator-data bytes off an attestation response.
 * `AuthenticatorAttestationResponse` exposes `getAuthenticatorData()`
 * in newer lib.dom.d.ts; older versions had it as a property. The
 * helper normalises both shapes so the wire serialization below
 * works regardless of which type definition the project pulls in.
 */
const readAttestationAuthData = (
  attestation: AuthenticatorAttestationResponse,
): ArrayBuffer => {
  const candidate = attestation as unknown as {
    getAuthenticatorData?: () => ArrayBuffer;
    authenticatorData?: ArrayBuffer;
  };
  if (typeof candidate.getAuthenticatorData === "function") {
    return candidate.getAuthenticatorData.call(attestation);
  }
  if (candidate.authenticatorData) {
    return candidate.authenticatorData;
  }
  throw new Error(
    "Authenticator response did not expose authenticatorData; cannot finish ceremony.",
  );
};

/**
 * Serialize an attestation response (the result of
 * `navigator.credentials.create()`) into the backend's
 * `PasskeyCeremonyFinishRequest` shape.
 */
const attestationToFinishRequest = (
  credential: PublicKeyCredential,
): PasskeyCeremonyFinishRequest => {
  const attestation = credential.response as AuthenticatorAttestationResponse;
  return {
    credential_id: bufferToByteArray(credential.rawId),
    client_data_json: bufferToByteArray(attestation.clientDataJSON),
    authenticator_data: bufferToByteArray(readAttestationAuthData(attestation)),
    signature: [], // present only on assertion responses, not attestation
  };
};

/**
 * Serialize an assertion response (the result of
 * `navigator.credentials.get()`) into the backend's
 * `PasskeyCeremonyFinishRequest` shape.
 */
const assertionToFinishRequest = (
  credential: PublicKeyCredential,
): PasskeyCeremonyFinishRequest => {
  const assertion = credential.response as AuthenticatorAssertionResponse;
  return {
    credential_id: bufferToByteArray(credential.rawId),
    client_data_json: bufferToByteArray(assertion.clientDataJSON),
    authenticator_data: bufferToByteArray(assertion.authenticatorData),
    signature: bufferToByteArray(assertion.signature),
  };
};

/**
 * Write the logged-in user into `useUserStore` and invalidate the
 * caller-side caches so downstream queries (e.g. `useUser`) rehydrate.
 */
const commitLogin = (user: JsUserAuth): void => {
  useUserStore.getState().setUser(
    new WersuUserImpl({
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url ?? "",
      email: user.email ?? "",
      email_verified_at: user.email_verified_at ?? "",
      is_active: user.is_active,
    }),
  );
  void queryClient.invalidateQueries({ queryKey: ["user"] });
  void queryClient.invalidateQueries({ queryKey: ["accessToken"] });
};

/**
 * Public hook API for the login flow.
 *
 * @returns a `useMutation` whose `mutate()` runs the full begin -> browser
 *          prompt -> finish roundtrip and resolves with the logged-in user.
 */
export function usePasskeyLogin(): UseMutationResult<JsUserAuth, Error, void> {
  const api = getPasskeyApi();
  return useMutation({
    mutationFn: async () => {
      requireWebAuthn();
      const begin = await api.loginBegin();
      const requestOptions = buildRequestOptions(begin);
      const credential = (await navigator.credentials.get({
        publicKey: requestOptions,
      })) as PublicKeyCredential | null;
      if (!credential) {
        throw new Error(
          "Passkey prompt was cancelled or no credential was selected.",
        );
      }
      const finishRequest = assertionToFinishRequest(credential);
      const user = await api.loginFinish(finishRequest);
      commitLogin(user);
      return user;
    },
  });
}

/**
 * Public hook API for the registration flow.
 *
 * For UX tests in environments without a WebAuthn authenticator, set
 * `webAuthnUnavailableMessage` to a custom string instead of the default.
 */
export interface UsePasskeyRegisterOptions {
  /** Optional friendly name to attach to the new passkey. */
  friendlyName?: string;
  /** Optional username hint for the backend (only used by register-begin). */
  username?: string;
}

export function usePasskeyRegister(
  options: UsePasskeyRegisterOptions = {},
): UseMutationResult<
  PasskeyCeremonyFinishReply,
  Error,
  UsePasskeyRegisterOptions
> {
  const api = getPasskeyApi();
  return useMutation({
    mutationFn: async (vars: UsePasskeyRegisterOptions) => {
      requireWebAuthn();
      const begin = await api.registerBegin({
        username: vars.username ?? options.username,
      });
      // Register normally returns user_id/user_name from the server,
      // but supply the active-user cache as a safety net so a partial
      // server reply can't crash the ceremony.
      const fallbackUser = resolveActiveUser();
      const creationOptions = buildCreationOptions(
        begin,
        vars.friendlyName ?? options.friendlyName,
        fallbackUser,
        false,
      );
      const credential = (await navigator.credentials.create({
        publicKey: creationOptions,
      })) as PublicKeyCredential | null;
      if (!credential) {
        throw new Error("Passkey creation was cancelled.");
      }
      const finishRequest = attestationToFinishRequest(credential);
      return await api.registerFinish(finishRequest);
    },
  });
}

/**
 * Public hook API for linking a new passkey to the currently
 * authenticated user. The backend requires the session cookie; the
 * browser handler is the same as registration but without a username.
 *
 * The linkBegin response deliberately omits `user_id` / `user_name`
 * because the server already knows who you are from the session
 * cookie. To populate the browser-side `user` block we read the
 * logged-in user from the cache (zustand store, hydrated by
 * `useUser`) and pass it as the fallback into `buildCreationOptions`.
 */
export function usePasskeyLink(): UseMutationResult<
  PasskeyCeremonyFinishReply,
  Error,
  { friendlyName?: string }
> {
  const api = getPasskeyApi();
  // Subscribe so a cold-start frame where the user lands on this card
  // before `useUser` has resolved still triggers the query when the
  // store hasn't been hydrated yet. The hook just touches the data
  // here; the store read happens at mutation time so we don't capture
  // a stale value.
  useUser();
  return useMutation({
    mutationFn: async (vars: { friendlyName?: string }) => {
      requireWebAuthn();
      const begin = await api.linkBegin();
      const fallbackUser = resolveActiveUser();
      const creationOptions = buildCreationOptions(
        begin,
        vars.friendlyName,
        fallbackUser,
        true,
      );
      const credential = (await navigator.credentials.create({
        publicKey: creationOptions,
      })) as PublicKeyCredential | null;
      if (!credential) {
        throw new Error("Passkey linking was cancelled.");
      }
      const finishRequest = attestationToFinishRequest(credential);
      return await api.linkFinish(finishRequest);
    },
  });
}

/**
 * Probe the runtime for WebAuthn support. Returns `true` when both
 * `navigator.credentials.create` and `.get` are present. UI code uses
 * this to decide whether to render the passkey button at all.
 */
export function isWebAuthnSupported(): boolean {
  try {
    requireWebAuthn();
    return true;
  } catch {
    return false;
  }
}

/**
 * Read-bytes helper exported for tests. Not used in the rendered flow.
 */
export const __test__ = {
  base64UrlToBytes,
  bytesToUint8,
  bufferToByteArray,
};
