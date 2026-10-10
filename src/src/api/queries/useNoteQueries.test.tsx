// Tier 1 tests for the JWT-ready gate in useNote. Pins the
// anonymous-public 401 regression (request fires before JWT).

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useNote } from "./useNoteQueries";
import { useAuthStore } from "../../zustand/useAuthStore";
import { apiRegistry } from "../apiRegistry";

const buildWrapper =
  (pathname: string, qc: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[pathname]}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );

const makeOkResponse = (body: unknown = {}): Response =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

type FetchSpy = ReturnType<typeof vi.fn> &
  ((...args: never[]) => Promise<Response>);

/**
 * Build a stubbed global `fetch` whose calls we can introspect
 * later. Cast to `typeof fetch` so `vi.stubGlobal` accepts the
 * narrow mock without per-call casts; the helper returns the
 * underlying `vi.fn` so `expect(...).toHaveBeenCalledTimes` works.
 */
const stubFetch = (impl: () => Promise<Response>): FetchSpy => {
  const spy = vi.fn(impl);
  vi.stubGlobal("fetch", spy as unknown as typeof fetch);
  return spy as FetchSpy;
};

const headersOf = (init: RequestInit | undefined): Record<string, string> => {
  if (!init) return {};
  const h = init.headers;
  if (!h) return {};
  if (h instanceof Headers) {
    const out: Record<string, string> = {};
    h.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(h)) {
    const out: Record<string, string> = {};
    for (const [k, v] of h) out[k] = v;
    return out;
  }
  return h as Record<string, string>;
};

beforeEach(() => {
  apiRegistry.installShareTokenProvider(null);
  useAuthStore.setState({ shareAccessToken: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  apiRegistry.installShareTokenProvider(null);
});

describe("useNote - JWT-ready gate (regression: anonymous-public-share 401s)", () => {
  it("public route + no JWT in store: stays disabled, fetch never fires", async () => {
    useAuthStore.setState({ shareAccessToken: null });

    const spy = vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(makeOkResponse({ id: "note-x" })),
    );
    vi.stubGlobal("fetch", spy);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = buildWrapper("/public/n/share-1", qc);
    const { result } = renderHook(() => useNote("note-x"), { wrapper });

    // TanStack Query uses microtasks; yield a few ticks before
    // asserting "no request went out".
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("public route + JWT set in store: fetches with the registered share-token header", async () => {
    // Pin the singleton contract. The token we install on the
    // registry MUST be the one that shows up in the Authorization
    // header of the request the hook issues. If `useNoteQueries`
    // regresses back to `new NoteApi()`, this fails.
    apiRegistry.installShareTokenProvider(() => "share-jwt-registered");
    useAuthStore.setState({ shareAccessToken: "share-jwt-registered" });

    const spy = vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(makeOkResponse({ id: "note-x", title: "hello" })),
    );
    vi.stubGlobal("fetch", spy);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = buildWrapper("/public/n/share-1", qc);
    const { result } = renderHook(() => useNote("note-x"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledTimes(1);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(headersOf(init).Authorization).toBe("Bearer share-jwt-registered");
    expect(init.credentials).toBe("omit");
  });

  it("private route + no JWT in store: gate is pass-through (cookie auth)", async () => {
    // Logged-in viewers don't have a share JWT and don't need one;
    // the `usePublicRouteShareJwtReady` hook should short-circuit
    // to `ready: true` on `/n/*` so the note fetch proceeds with
    // the cookie.
    useAuthStore.setState({ shareAccessToken: null });
    apiRegistry.installShareTokenProvider(null);

    const spy = vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(makeOkResponse({ id: "note-x" })),
    );
    vi.stubGlobal("fetch", spy);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = buildWrapper("/n/note-x", qc);
    const { result } = renderHook(() => useNote("note-x"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledTimes(1);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(headersOf(init).Authorization).toBeUndefined();
    expect(init.credentials).toBe("include");
  });

  it("public route: gate releases as soon as the JWT lands in the store (mid-mount)", async () => {
    // Mount with the JWT absent, write the token mid-flight, and
    // assert the query then fires. Pins that the gate subscribes
    // to the store (not just the initial value).
    apiRegistry.installShareTokenProvider(
      () => useAuthStore.getState().shareAccessToken,
    );
    useAuthStore.setState({ shareAccessToken: null });

    const spy = vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(makeOkResponse({ id: "note-x", title: "released" })),
    );
    vi.stubGlobal("fetch", spy);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = buildWrapper("/public/n/share-1", qc);
    const { result } = renderHook(() => useNote("note-x"), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });
    expect(spy).not.toHaveBeenCalled();

    act(() => {
      useAuthStore.setState({ shareAccessToken: "share-jwt-late" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(headersOf(init).Authorization).toBe("Bearer share-jwt-late");
  });
});
