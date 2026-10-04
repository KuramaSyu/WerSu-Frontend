// Tier 1 tests for the offline-mode flow in `useNoteCollaboration`.
//
// Goal: lock in the new lazy-IndexedDB behaviour and the offline /
// online transitions so a refactor of the WS-failure watcher or
// the `enterOfflineMode` helper does not silently regress the
// contract. The tests are pure (jsdom + vi.mock for the heavy
// collaborators) and do not open real WebSockets.

// @vitest-environment jsdom

// Skipping `../test/setup` here: that file's lazy store loaders
// touch `useThemeStore` which transitively imports
// `@material/material-color-utilities/dynamiccolor/dynamic_scheme`,
// a subpath the package's exports field rejects under the `node`
// condition. The offline-mode flow only needs the auth + collab
// status stores, which we set up directly below.

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
    websocketProvider: {
      on: Mock;
      off: Mock;
      emit: Mock;
      status: string;
    };
    connect: Mock;
    disconnect: Mock;
    on: Mock;
    off: Mock;
  }>,
  persistence: [] as Array<{ name: string; doc: unknown; destroy: Mock }>,
}));

vi.mock("@hocuspocus/provider", () => {
  return {
    HocuspocusProvider: vi.fn().mockImplementation(function (
      this: unknown,
      config: unknown,
    ) {
      const ws = {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        status: "disconnected",
      };
      const instance = {
        config,
        configuration: { websocketProvider: ws },
        websocketProvider: ws,
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

// Stub the broken material-color-utilities import chain. Mirrors
// the same workaround used in `src/theme/themes.test.ts`.
vi.mock("@material/material-color-utilities", () => ({
  __esModule: true,
  default: {},
  themeFromSourceColor: () => ({}),
  argbFromHex: () => 0,
  hexFromArgb: () => "#000000",
  DynamicScheme: class {},
  Hct: { from: () => ({}) },
  TonalPalette: class {},
}));

// Stub the access-token React Query hook so the hook does not need
// a real QueryClientProvider in this test.
vi.mock("../api/queries/useAccessToken", () => ({
  useAccessToken: () => ({
    data: "test-jwt",
    isError: false,
    error: undefined,
  }),
}));

vi.mock("y-indexeddb", () => {
  return {
    IndexeddbPersistence: vi.fn().mockImplementation(function (
      this: unknown,
      name: string,
      doc: unknown,
    ) {
      const instance = {
        name,
        doc,
        destroy: vi.fn().mockResolvedValue(undefined),
        synced: true,
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
      };
      recorder.persistence.push(instance);
      return instance;
    }),
  };
});

import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  goOffline,
  goOnline,
  getCollabEntry,
  rehydrateCollabSession,
  useNoteCollaboration,
} from "./useNoteCollaboration";

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
    accessToken: "test-jwt",
    shareAccessToken: null,
    listeners: new Set(),
  });
  collabStatusStore.setState({ byNoteId: {}, diagnostics: {} });
});

afterEach(() => {
  // Each test uses a unique noteId; nothing to clean up besides
  // resetting the global state.
});

describe("useNoteCollaboration - lazy IndexedDB", () => {
  it("does NOT create IndexedDB persistence on the happy path", () => {
    renderHook(() => useNoteCollaboration("n-offline-1"));
    expect(mockedProvider).toHaveBeenCalledTimes(1);
    expect(mockedPersistence).not.toHaveBeenCalled();
    expect(getCollabEntry("n-offline-1")?.persistence).toBeNull();
  });

  it("creates IndexedDB when goOffline is called with origin=manual", async () => {
    renderHook(() => useNoteCollaboration("n-offline-2"));
    expect(mockedPersistence).not.toHaveBeenCalled();
    await act(async () => {
      await goOffline("n-offline-2", "manual", "pre-offline-markdown");
    });
    expect(mockedPersistence).toHaveBeenCalledTimes(1);
    expect(mockedPersistence.mock.calls[0][0]).toBe("note-n-offline-2");
    const entry = getCollabEntry("n-offline-2");
    expect(entry?.persistence).not.toBeNull();
    expect(entry?.offlineOrigin).toBe("manual");
    expect(entry?.preOfflineCloudMarkdown).toBe("pre-offline-markdown");
    expect(collabStatusStore.getState().byNoteId["n-offline-2"]).toBe(
      "editingOffline",
    );
    // Provider was disconnected as part of the transition.
    expect(entry?.provider.disconnect).toHaveBeenCalled();
  });

  it("goOnline transitions back to connecting and reconnects", async () => {
    renderHook(() => useNoteCollaboration("n-offline-3"));
    await act(async () => {
      await goOffline("n-offline-3", "manual");
    });
    const entry = getCollabEntry("n-offline-3");
    // Cast to access the mock's `connect` Mock for assertion. The
    // runtime shape is the mocked instance from the vi.mock above.
    const provider = entry?.provider as unknown as {
      connect: { mockClear: () => void };
    };
    provider.connect.mockClear();
    act(() => {
      goOnline("n-offline-3");
    });
    expect(provider.connect).toHaveBeenCalled();
    expect(collabStatusStore.getState().byNoteId["n-offline-3"]).toBe(
      "connecting",
    );
  });

  it("goOffline is idempotent: a second call is a no-op", async () => {
    renderHook(() => useNoteCollaboration("n-offline-4"));
    await act(async () => {
      await goOffline("n-offline-4", "manual", "pre-offline-cloud");
    });
    await act(async () => {
      await goOffline("n-offline-4", "manual", "second-call");
    });
    // Persistence still only created once.
    expect(mockedPersistence).toHaveBeenCalledTimes(1);
    // The pre-offline snapshot from the first call wins (subsequent
    // calls don't overwrite it; the user has to rehydrate to do
    // that).
    expect(getCollabEntry("n-offline-4")?.preOfflineCloudMarkdown).toBe(
      "pre-offline-cloud",
    );
    expect(getCollabEntry("n-offline-4")?.preOfflineCloudMarkdown).not.toBe(
      "second-call",
    );
  });
});

describe("useNoteCollaboration - WS failure watchers", () => {
  it("attaches maxAttemptsFailed + disconnect watchers to the inner websocketProvider", () => {
    renderHook(() => useNoteCollaboration("n-ws-watch-1"));
    const entry = getCollabEntry("n-ws-watch-1");
    const ws = (
      entry?.provider as unknown as {
        configuration: { websocketProvider: { on: Mock } };
      }
    ).configuration.websocketProvider;
    const eventNames = ws.on.mock.calls.map((c) => c[0]);
    expect(eventNames).toEqual(
      expect.arrayContaining([
        "maxAttemptsFailed",
        "disconnect",
        "open",
        "connect",
      ]),
    );
  });

  it("auto-falls-back to offline mode on maxAttemptsFailed", async () => {
    renderHook(() => useNoteCollaboration("n-ws-watch-2"));
    const entry = getCollabEntry("n-ws-watch-2");
    const ws = (
      entry?.provider as unknown as {
        configuration: { websocketProvider: { on: Mock; emit: Mock } };
      }
    ).configuration.websocketProvider;
    // Find the maxAttemptsFailed handler the hook registered and
    // call it directly.
    const handler = ws.on.mock.calls.find(
      (c) => c[0] === "maxAttemptsFailed",
    )?.[1] as () => void;
    expect(handler).toBeDefined();
    await act(async () => {
      handler();
      // The async goOffline call resolves on the next microtask.
      await Promise.resolve();
    });
    expect(collabStatusStore.getState().byNoteId["n-ws-watch-2"]).toBe(
      "editingOffline",
    );
    expect(getCollabEntry("n-ws-watch-2")?.offlineOrigin).toBe("auto");
  });
});

describe("useNoteCollaboration - rehydrateCollabSession", () => {
  it("destroys the old ydoc and provider and seeds a fresh entry", async () => {
    renderHook(() => useNoteCollaboration("n-rehydrate-1"));
    const before = getCollabEntry("n-rehydrate-1");
    expect(before).toBeDefined();
    await act(async () => {
      await rehydrateCollabSession("n-rehydrate-1", "seed markdown");
    });
    const after = getCollabEntry("n-rehydrate-1");
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
    expect(after?.provider).not.toBe(before?.provider);
    // The new entry has no persistence yet (it will be re-attached
    // when the user next goes offline).
    expect(after?.persistence).toBeNull();
    expect(after?.offlineOrigin).toBeNull();
    // The old provider was disconnected and a new one was created.
    expect(mockedProvider).toHaveBeenCalledTimes(2);
  });
});
