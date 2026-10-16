// Tier 1 tests for the passkey ceremony hooks.
//
// Pins the wire-shape contract between the Go backend and
// base64UrlToBytes / buildCreationOptions. The whole point of these
// tests is to catch a future change that drops the defensive guard
// against a malformed begin reply — without it, the "Add passkey"
// path crashes with `TypeError: cannot access property 'replace' of
// undefined` instead of reporting the real problem to the user.

// @vitest-environment jsdom

import "../../test/setup";

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
