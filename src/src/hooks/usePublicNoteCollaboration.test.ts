// Tier 1 tests for the public collaboration hook.
//
// Goal: lock in the lifecycle of the public WebSocket session so
// refactors don't silently regress the contract the editor relies on:
//
//   1. The provider is gated on `useAuthStore.shareAccessToken` -
//      no token -> no provider, status flips to `awaitingToken`.
//   2. The provider is created with the share token callback so JWT
//      rotations land on the next handshake (no recreate needed).
//   3. The provider auto-connects on instantiation (we pass no
//      `connect: false`).
//   4. A second mount with the same `noteId` reuses the cached
//      provider and calls `connect()` on the existing instance
//      rather than creating a duplicate.
//   5. When `shareAccessToken` rotates, every cached provider is
//      reconnected so the new token actually reaches the server.
//
// We mock the heavy collaborators (`@hocuspocus/provider`,
// `y-indexeddb`) so no real WebSocket / IndexedDB is touched. The
// yjs module is left unmocked so the cache types still match.
//
// `renderHook` from `@testing-library/react` needs a DOM, so this
// file opts into the jsdom environment via the directive below.

// @vitest-environment jsdom

import "../test/setup";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAuthStore } from "../zustand/useAuthStore";
import { collabStatusStore } from "../zustand/useCollabStatusStore";

// Module mocks must be hoisted, so we use vi.hoisted to share the
// recorder array with the factory callbacks.
const recorder = vi.hoisted(() => ({
  providers: [] as Array<{
    config: unknown;
    connect: Mock;
    disconnect: Mock;
    on: Mock;
    off: Mock;
  }>,
  persistence: [] as Array<{ name: string; doc: unknown }>,
}));

vi.mock("@hocuspocus/provider", () => {
  return {
    HocuspocusProvider: vi.fn().mockImplementation(function (
      this: unknown,
      config: unknown,
    ) {
      const instance = {
        config,
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      };
      recorder.providers.push(instance);
      return instance;
    }),
  };
});

vi.mock("y-indexeddb", () => {
  return {
    IndexeddbPersistence: vi.fn().mockImplementation(function (
      this: unknown,
      name: string,
      doc: unknown,
    ) {
      recorder.persistence.push({ name, doc });
      // Return a plain object that mimics the IndexeddbPersistence
      // surface the consumer actually touches (none, in this hook).
      return { name, doc };
    }),
  };
});

// Now we can import the hook - it transitively pulls in the mocks above.
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  getPublicCollabEntry,
  usePublicNoteCollaboration,
} from "./usePublicNoteCollaboration";

const mockedProvider = HocuspocusProvider as unknown as Mock;
const mockedPersistence = IndexeddbPersistence as unknown as Mock;

const resetRecorder = () => {
  recorder.providers.length = 0;
  recorder.persistence.length = 0;
  mockedProvider.mockClear();
  mockedPersistence.mockClear();
};

beforeEach(() => {
  resetRecorder();
  useAuthStore.setState({
    accessToken: null,
    shareAccessToken: null,
    listeners: new Set(),
  });
  // Clear the collab status so the per-noteId state from a previous
  // test doesn't leak in.
  collabStatusStore.setState({ byNoteId: {}, diagnostics: {} });
});

afterEach(() => {
  // Each test creates at most one provider for "n1". Drop it so the
  // next test doesn't see a cached entry and skip provider creation.
  getPublicCollabEntry("n1")?.provider.disconnect();
  // Module-level cache is shared across tests in the same file, so
  // we have to clear the map directly. We reach in via the hook's
  // cache (the Map is module-scope and not exported, so we go
  // through the only public side-effect we have).
  recorder.providers.length = 0;
  // Force-clear by re-importing the module is not safe in Vitest, so
  // we accept that the cache survives between tests and pick a
  // unique noteId per describe block instead.
});

describe("usePublicNoteCollaboration - token gating", () => {
  it("does not create a provider when no share token is available", () => {
    renderHook(() => usePublicNoteCollaboration("n-token-gate-1"));

    expect(mockedProvider).not.toHaveBeenCalled();
    expect(mockedPersistence).not.toHaveBeenCalled();
    expect(getPublicCollabEntry("n-token-gate-1")).toBeUndefined();
    expect(collabStatusStore.getState().byNoteId["n-token-gate-1"]).toBe(
      "awaitingToken",
    );
  });

  it("creates a provider with the share token once it lands", () => {
    const { result, rerender } = renderHook(
      () => usePublicNoteCollaboration("n-token-gate-2"),
      { initialProps: { token: null as string | null } },
    );

    expect(mockedProvider).not.toHaveBeenCalled();

    act(() => {
      useAuthStore.getState().setShareAccessToken("share-jwt-abc");
    });
    rerender({ token: "share-jwt-abc" });

    expect(mockedProvider).toHaveBeenCalledTimes(1);
    const config = mockedProvider.mock.calls[0][0];
    expect(config.name).toBe("public-note-n-token-gate-2");
    // The dev .env wires the WS URL to the local Hocuspocus server.
    expect(config.url).toBe("ws://localhost:8666");
    // The token is a function so JWT rotations land on handshake.
    expect(typeof config.token).toBe("function");
    expect((config.token as () => string)()).toBe("share-jwt-abc");

    // The returned cache entry references the same provider.
    expect(result.current?.provider).toBe(recorder.providers[0]);
    expect(getPublicCollabEntry("n-token-gate-2")?.provider).toBe(
      recorder.providers[0],
    );
  });

  it("reuses the cached provider when the hook is mounted a second time with the same noteId", () => {
    // First mount - creates the provider.
    renderHook(() => usePublicNoteCollaboration("n-reuse-1"));
    act(() => {
      useAuthStore.getState().setShareAccessToken("share-jwt-1");
    });
    expect(mockedProvider).toHaveBeenCalledTimes(1);
    const firstProvider = recorder.providers[0];
    firstProvider.connect.mockClear();

    // Second mount with the same noteId - must NOT create a new
    // provider, but MUST call connect() on the cached one.
    const second = renderHook(() => usePublicNoteCollaboration("n-reuse-1"));
    expect(mockedProvider).toHaveBeenCalledTimes(1);
    expect(firstProvider.connect).toHaveBeenCalledTimes(1);
    expect(second.result.current?.provider).toBe(firstProvider);
  });
});

describe("usePublicNoteCollaboration - token rotation", () => {
  it("reconnects every cached provider when the share token rotates", () => {
    // Mount two notes so we can verify the rotation hits both.
    renderHook(() => usePublicNoteCollaboration("n-rotate-a"));
    renderHook(() => usePublicNoteCollaboration("n-rotate-b"));

    act(() => {
      useAuthStore.getState().setShareAccessToken("share-jwt-1");
    });
    expect(mockedProvider).toHaveBeenCalledTimes(2);
    const [provA, provB] = recorder.providers;

    act(() => {
      useAuthStore.getState().setShareAccessToken("share-jwt-2");
    });

    // The contract: every cached provider is reconnected on rotation.
    // We don't pin the exact call count because each `useEffect`
    // mount sets up its own auth-store subscriber, so the
    // `connect()` count is a function of the number of mount sites.
    // What matters is that the rotation actually reaches every
    // provider and the new token is what the next handshake sends.
    expect(provA.connect).toHaveBeenCalled();
    expect(provB.connect).toHaveBeenCalled();

    // The handshake function picks up the new token.
    const configA = mockedProvider.mock.calls[0][0];
    expect((configA.token as () => string)()).toBe("share-jwt-2");
  });
});
