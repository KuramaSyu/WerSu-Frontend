// Tier 1 tests for the passkey ceremony hooks.
//
// Pins the wire-shape contract between the Go backend and
// base64UrlToBytes / buildCreationOptions. The whole point of these
// tests is to catch a future change that drops the defensive guard
// against a malformed begin reply — without it, the "Add passkey"
// path crashes with `TypeError: cannot access property 'replace' of
// undefined` instead of reporting the real problem to the user.

// @vitest-environment jsdom

import "../test/setup";

vi.mock("@material/material-color-utilities", () => ({}));

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockRegisterBegin = vi.fn();
const mockRegisterFinish = vi.fn();
const mockLoginBegin = vi.fn();
const mockLoginFinish = vi.fn();
const mockLinkBegin = vi.fn();
const mockLinkFinish = vi.fn();
const mockListPasskeys = vi.fn();
const mockRevokePasskey = vi.fn();

vi.mock("../api/PasskeyApi", () => ({
  getPasskeyApi: () => ({
    registerBegin: (...args: unknown[]) => mockRegisterBegin(...args),
    registerFinish: (...args: unknown[]) => mockRegisterFinish(...args),
    loginBegin: (...args: unknown[]) => mockLoginBegin(...args),
    loginFinish: (...args: unknown[]) => mockLoginFinish(...args),
    linkBegin: (...args: unknown[]) => mockLinkBegin(...args),
    linkFinish: (...args: unknown[]) => mockLinkFinish(...args),
    listPasskeys: (...args: unknown[]) => mockListPasskeys(...args),
    revokePasskey: (...args: unknown[]) => mockRevokePasskey(...args),
  }),
}));

// `usePasskeyCeremony` reaches `DiscordLogin` (for `WersuUserImpl`) and
// `useUser` (called as a side-effect in `usePasskeyLink`). Both
// transitively pull in `@mui/material`, whose deep ESM graph fails to
// resolve `react-transition-group/TransitionGroupContext` under Vite.
// Mocking just the two symbols the hook actually consumes keeps the
// rest of the import graph out of the way without dragging in MUI.
vi.mock("../components/DiscordLogin", () => ({
  WersuUserImpl: class WersuUserImpl {
    id = "";
    username = "";
    avatar_url = "";
    email = "";
    email_verified_at = "";
    is_active = false;
    streak: number | null = null;
    constructor(data: Record<string, unknown>) {
      this.id = (data.id as string) ?? "";
      this.username = (data.username as string) ?? "";
      this.avatar_url = (data.avatar_url as string) ?? "";
      this.email = (data.email as string) ?? "";
      this.email_verified_at = (data.email_verified_at as string) ?? "";
      this.is_active = (data.is_active as boolean) ?? false;
    }
  },
}));
vi.mock("../api/queries/useUser", () => ({
  useUser: () => ({ data: undefined, isSuccess: false }),
}));

import { useUserStore } from "../zustand/userStore";
import { WersuUserImpl } from "../components/DiscordLogin";
import {
  isWebAuthnSupported,
  usePasskeyLink,
  usePasskeyLogin,
  usePasskeyRegister,
  WebAuthnUnavailableError,
} from "./usePasskeyCeremony";

const fakeUser = {
  id: "u1",
  username: "alice",
  avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
  email: "alice@example.com",
  email_verified_at: "",
  is_active: true,
};

const buildWrapper =
  (qc: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

beforeEach(() => {
  mockRegisterBegin.mockReset();
  mockRegisterFinish.mockReset();
  mockLoginBegin.mockReset();
  mockLoginFinish.mockReset();
  mockLinkBegin.mockReset();
  mockLinkFinish.mockReset();
  mockListPasskeys.mockReset();
  mockRevokePasskey.mockReset();
  useUserStore.setState({ user: new WersuUserImpl(fakeUser) });
  // jsdom doesn't ship `navigator.credentials`; without this shim the
  // mutation short-circuits on `requireWebAuthn()` before any of the
  // begin-reply validation paths get a chance to fire. The browser
  // support describe block removes it on purpose to test the missing-
  // credentials path and restores it via its `finally`.
  if (!navigator.credentials) {
    Object.defineProperty(navigator, "credentials", {
      value: { create: vi.fn(), get: vi.fn() },
      configurable: true,
      writable: true,
    });
  }
});

afterEach(() => {
  useUserStore.setState({ user: null });
});

describe("passkey ceremony hooks - malformed begin reply", () => {
  it("linkBegin throws a neutral error when the server returns no challenge", async () => {
    mockLinkBegin.mockResolvedValueOnce({ rp_id: "rp", rp_name: "WerSu" });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyLink(), {
      wrapper: buildWrapper(qc),
    });
    result.current.mutate({}, { onError: () => undefined });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(
      /server reply missing challenge/i,
    );
    // Must NOT claim the server is unconfigured - it just returned 200.
    expect(result.current.error?.message).not.toMatch(
      /passkey support is not configured/i,
    );
    expect(result.current.error?.message).not.toMatch(/replace/i);
  });

  it("registerBegin throws a neutral error when the server returns no challenge", async () => {
    mockRegisterBegin.mockResolvedValueOnce({ rp_id: "rp", rp_name: "WerSu" });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyRegister(), {
      wrapper: buildWrapper(qc),
    });
    result.current.mutate({}, { onError: () => undefined });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(
      /server reply missing challenge/i,
    );
    expect(result.current.error?.message).not.toMatch(
      /passkey support is not configured/i,
    );
    expect(result.current.error?.message).not.toMatch(/replace/i);
  });

  it("loginBegin throws a neutral error when the server returns no challenge", async () => {
    mockLoginBegin.mockResolvedValueOnce({ rp_id: "rp", rp_name: "WerSu" });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyLogin(), {
      wrapper: buildWrapper(qc),
    });
    result.current.mutate(undefined, { onError: () => undefined });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(
      /server reply missing challenge/i,
    );
    expect(result.current.error?.message).not.toMatch(
      /passkey support is not configured/i,
    );
    expect(result.current.error?.message).not.toMatch(/replace/i);
  });

  it("linkBegin throws a neutral error when the server omits session_key", async () => {
    // Regression for the SPA /finish bug: the backend logs
    // `session_key=` (empty) when the SPA drops the nonce on the
    // floor. Pins the defensive guard so a partial reply can't ship
    // a /finish body without the round-trip key.
    mockLinkBegin.mockResolvedValueOnce({
      challenge: "Y2hhbGxlbmdl",
      rp_id: "rp",
      rp_name: "WerSu",
      user_id: "dXNlcg",
      user_name: "alice",
      // session_key intentionally omitted
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyLink(), {
      wrapper: buildWrapper(qc),
    });
    result.current.mutate({}, { onError: () => undefined });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(
      /server reply missing session_key/i,
    );
    // Must NOT misreport the challenge - that one was present.
    expect(result.current.error?.message).not.toMatch(/missing challenge/i);
    // Must NOT claim the server is unconfigured - it just omitted one field.
    expect(result.current.error?.message).not.toMatch(
      /passkey support is not configured/i,
    );
    // Must NOT have reached the backend.
    expect(mockLinkFinish).not.toHaveBeenCalled();
  });
});

describe("passkey ceremony hooks - browser support", () => {
  it("isWebAuthnSupported reports false when navigator.credentials is missing", () => {
    const original = (navigator as unknown as { credentials?: unknown })
      .credentials;
    delete (navigator as unknown as { credentials?: unknown }).credentials;
    try {
      expect(isWebAuthnSupported()).toBe(false);
    } finally {
      (navigator as unknown as { credentials?: unknown }).credentials =
        original;
    }
  });

  it("WebAuthnUnavailableError surfaces the unavailable message", () => {
    const err = new WebAuthnUnavailableError("nope");
    expect(err.name).toBe("WebAuthnUnavailableError");
    expect(err.message).toBe("nope");
  });
});

// Tier 1 tests for the `/finish` wire shape. Pins the contract that
// the browser-side `PublicKeyCredential` is forwarded nested under
// `credential` (so the backend library can parse it) with all binary
// buffers base64url-encoded. A regression to the old flattened
// `{credential_id: number[], ...}` shape would surface as
// `Parse error for Registration` server-side, which is exactly the
// bug these tests guard against.
describe("passkey ceremony hooks - finish wire shape", () => {
  const fakeAttestationCredential = {
    id: "cred-att",
    rawId: new Uint8Array([1, 2, 3, 4]).buffer,
    type: "public-key",
    authenticatorAttachment: "platform",
    response: {
      clientDataJSON: new Uint8Array([10, 20, 30]).buffer,
      attestationObject: new Uint8Array([40, 50, 60, 70, 80]).buffer,
      getTransports: () => ["internal", "hybrid"],
    },
    getClientExtensionResults: () => ({ appid: true }),
  };
  const fakeAssertionCredential = {
    id: "cred-assert",
    rawId: new Uint8Array([5, 6]).buffer,
    type: "public-key",
    authenticatorAttachment: "cross-platform",
    response: {
      clientDataJSON: new Uint8Array([11]).buffer,
      authenticatorData: new Uint8Array([21, 22, 23]).buffer,
      signature: new Uint8Array([31, 32]).buffer,
      userHandle: new Uint8Array([41, 42, 43, 44]).buffer,
    },
    getClientExtensionResults: () => ({}),
  };

  // Every base64url string we generate on this side must round-trip
  // through `base64.RawURLEncoding` on the backend. That encoding
  // rejects `+`, `/`, and `=`; a single stray `=` is enough to make
  // `ParseCredentialCreationResponse` fail.
  const expectBase64UrlNoPad = (value: unknown): void => {
    expect(typeof value).toBe("string");
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(value).not.toMatch(/[+/=]/);
  };

  it("linkFinish receives the raw PublicKeyCredential nested under credential (attestation case)", async () => {
    mockLinkBegin.mockResolvedValueOnce({
      challenge: "Y2hhbGxlbmdl",
      rp_id: "rp",
      rp_name: "WerSu",
      session_key: "sk",
      user_id: "dXNlcg",
      user_name: "alice",
    });
    vi.mocked(navigator.credentials.create).mockResolvedValueOnce(
      fakeAttestationCredential as unknown as PublicKeyCredential,
    );
    mockLinkFinish.mockResolvedValueOnce({ credential_id: "cred-att" });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyLink(), {
      wrapper: buildWrapper(qc),
    });
    await result.current.mutateAsync({ friendlyName: "iPhone" });

    expect(mockLinkFinish).toHaveBeenCalledTimes(1);
    const body = mockLinkFinish.mock.calls[0][0] as Record<string, unknown>;
    expect(body.session_key).toBe("sk");
    expect(body.friendly_name).toBe("iPhone");
    const credential = body.credential as Record<string, unknown>;
    expect(credential.id).toBe("cred-att");
    expect(credential.type).toBe("public-key");
    expect(credential.authenticatorAttachment).toBe("platform");
    expect(credential.clientExtensionResults).toEqual({ appid: true });
    const response = credential.response as Record<string, unknown>;
    // Attestation inners, not assertion ones.
    expect(typeof response.clientDataJSON).toBe("string");
    expect(typeof response.attestationObject).toBe("string");
    expect(response.transports).toEqual(["internal", "hybrid"]);
    expect(response.authenticatorData).toBeUndefined();
    expect(response.signature).toBeUndefined();
    expect(response.userHandle).toBeUndefined();
    // Regression guard: the old flat fields must not leak through.
    expect(body).not.toHaveProperty("credential_id");
    expect(body).not.toHaveProperty("client_data_json");
    expect(body).not.toHaveProperty("authenticator_data");
  });

  it("registerFinish receives the raw PublicKeyCredential nested under credential (attestation case)", async () => {
    mockRegisterBegin.mockResolvedValueOnce({
      challenge: "Y2hhbGxlbmdl",
      rp_id: "rp",
      rp_name: "WerSu",
      session_key: "sk",
      user_id: "dXNlcg",
      user_name: "alice",
    });
    vi.mocked(navigator.credentials.create).mockResolvedValueOnce(
      fakeAttestationCredential as unknown as PublicKeyCredential,
    );
    mockRegisterFinish.mockResolvedValueOnce({ credential_id: "cred-att" });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyRegister(), {
      wrapper: buildWrapper(qc),
    });
    await result.current.mutateAsync({ friendlyName: "MacBook" });

    expect(mockRegisterFinish).toHaveBeenCalledTimes(1);
    const body = mockRegisterFinish.mock.calls[0][0] as Record<string, unknown>;
    expect(body.session_key).toBe("sk");
    expect(body.friendly_name).toBe("MacBook");
    const credential = body.credential as Record<string, unknown>;
    expect(credential.id).toBe("cred-att");
    expect(credential.type).toBe("public-key");
    expect(credential.authenticatorAttachment).toBe("platform");
    const response = credential.response as Record<string, unknown>;
    expect(typeof response.clientDataJSON).toBe("string");
    expect(typeof response.attestationObject).toBe("string");
    expect(response.transports).toEqual(["internal", "hybrid"]);
  });

  it("loginFinish receives the raw PublicKeyCredential nested under credential (assertion case)", async () => {
    mockLoginBegin.mockResolvedValueOnce({
      challenge: "Y2hhbGxlbmdl",
      rp_id: "rp",
      rp_name: "WerSu",
      session_key: "sk",
    });
    vi.mocked(navigator.credentials.get).mockResolvedValueOnce(
      fakeAssertionCredential as unknown as PublicKeyCredential,
    );
    mockLoginFinish.mockResolvedValueOnce({
      id: "u1",
      username: "alice",
      is_active: true,
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyLogin(), {
      wrapper: buildWrapper(qc),
    });
    await result.current.mutateAsync();

    expect(mockLoginFinish).toHaveBeenCalledTimes(1);
    const body = mockLoginFinish.mock.calls[0][0] as Record<string, unknown>;
    expect(body.session_key).toBe("sk");
    // No friendly_name on login.
    expect(body.friendly_name).toBeUndefined();
    const credential = body.credential as Record<string, unknown>;
    expect(credential.id).toBe("cred-assert");
    expect(credential.type).toBe("public-key");
    expect(credential.authenticatorAttachment).toBe("cross-platform");
    const response = credential.response as Record<string, unknown>;
    // Assertion inners, not attestation ones.
    expect(typeof response.clientDataJSON).toBe("string");
    expect(typeof response.authenticatorData).toBe("string");
    expect(typeof response.signature).toBe("string");
    expect(typeof response.userHandle).toBe("string");
    expect(response.attestationObject).toBeUndefined();
    expect(response.transports).toBeUndefined();
  });

  it("all binary buffers are encoded as base64url without padding", async () => {
    mockLinkBegin.mockResolvedValueOnce({
      challenge: "Y2hhbGxlbmdl",
      rp_id: "rp",
      rp_name: "WerSu",
      session_key: "sk",
      user_id: "dXNlcg",
      user_name: "alice",
    });
    vi.mocked(navigator.credentials.create).mockResolvedValueOnce(
      fakeAttestationCredential as unknown as PublicKeyCredential,
    );
    mockLinkFinish.mockResolvedValueOnce({});
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyLink(), {
      wrapper: buildWrapper(qc),
    });
    await result.current.mutateAsync({});

    const body = mockLinkFinish.mock.calls[0][0] as Record<string, unknown>;
    const credential = body.credential as Record<string, unknown>;
    const response = credential.response as Record<string, unknown>;
    expectBase64UrlNoPad(credential.rawId);
    expectBase64UrlNoPad(response.clientDataJSON);
    expectBase64UrlNoPad(response.attestationObject);
  });

  it("omits friendly_name when the caller doesn't supply one", async () => {
    mockLinkBegin.mockResolvedValueOnce({
      challenge: "Y2hhbGxlbmdl",
      rp_id: "rp",
      rp_name: "WerSu",
      session_key: "sk",
      user_id: "dXNlcg",
      user_name: "alice",
    });
    vi.mocked(navigator.credentials.create).mockResolvedValueOnce(
      fakeAttestationCredential as unknown as PublicKeyCredential,
    );
    mockLinkFinish.mockResolvedValueOnce({});
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyLink(), {
      wrapper: buildWrapper(qc),
    });
    await result.current.mutateAsync({});

    const body = mockLinkFinish.mock.calls[0][0] as Record<string, unknown>;
    expect(body).not.toHaveProperty("friendly_name");
  });

  it("omits userHandle when the browser reports null (no discoverable credential handle)", async () => {
    mockLoginBegin.mockResolvedValueOnce({
      challenge: "Y2hhbGxlbmdl",
      rp_id: "rp",
      rp_name: "WerSu",
      session_key: "sk",
    });
    vi.mocked(navigator.credentials.get).mockResolvedValueOnce({
      ...fakeAssertionCredential,
      response: {
        ...fakeAssertionCredential.response,
        userHandle: null,
      },
    } as unknown as PublicKeyCredential);
    mockLoginFinish.mockResolvedValueOnce({
      id: "u1",
      username: "alice",
      is_active: true,
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => usePasskeyLogin(), {
      wrapper: buildWrapper(qc),
    });
    await result.current.mutateAsync();

    const body = mockLoginFinish.mock.calls[0][0] as Record<string, unknown>;
    const credential = body.credential as Record<string, unknown>;
    const response = credential.response as Record<string, unknown>;
    expect(response.userHandle).toBeUndefined();
    expect(response.signature).toBeDefined();
  });
});
