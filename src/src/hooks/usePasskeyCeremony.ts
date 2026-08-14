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
 * Build the `PublicKeyCredentialCreationOptions` document the browser
 * consumes during `navigator.credentials.create()`.
 *
 * The backend's `PasskeyCeremonyBeginReply` is the bare minimum needed
 * to identify the ceremony (challenge + rp + user). The rest of the
 * fields use sensible defaults for a passwordless UX.
 */
const buildCreationOptions = (
  reply: PasskeyCeremonyBeginReply,
  friendlyName?: string,
): PublicKeyCredentialCreationOptions => {
  if (!reply.user_id || !reply.user_name) {
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
      id: base64UrlToBytes(reply.user_id),
      name: reply.user_name,
      // `displayName` falls back to the username; backend doesn't ship
      // a separate display name yet.
      displayName: friendlyName ?? reply.user_name,
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
      const creationOptions = buildCreationOptions(
        begin,
        vars.friendlyName ?? options.friendlyName,
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
 */
export function usePasskeyLink(): UseMutationResult<
  PasskeyCeremonyFinishReply,
  Error,
  { friendlyName?: string }
> {
  const api = getPasskeyApi();
  return useMutation({
    mutationFn: async (vars: { friendlyName?: string }) => {
      requireWebAuthn();
      const begin = await api.linkBegin();
      const creationOptions = buildCreationOptions(begin, vars.friendlyName);
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
