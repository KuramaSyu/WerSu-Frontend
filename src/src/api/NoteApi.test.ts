// Tier 1 tests for `GET /api/notes/:id` auth in private + public
// modes. Pins the regression behind the "Authorization header not
// found, falling back to session-based authentication" backend log.
//
// Two layers:
// 1. Per-instance: `setShareTokenProvider` directly on a fresh
//    `NoteApi`.
// 2. Registry-driven: install via `installShareTokenProvider`
//    -> assert singleton == broadcast-set object.
//
// Wire shape pinned:
// - Private: `credentials: "include"`, no `Authorization`.
// - Public: `Authorization: Bearer <jwt>`, `credentials: "omit"`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteApi, getNoteApi, NOTE_API_TOKEN } from "./NoteApi";
import { apiRegistry } from "./apiRegistry";

// `VITE_BACKEND_URL` is read from `import.meta.env` at module load;
// we assert the full URL so the test works regardless of which
// `.env` is loaded - the contract is really about the `id` segment.
const NOTE_PATH = "http://localhost:8080/api/notes/note-1";

const mockFetchOk = (body: unknown = {}) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return { spy, calls };
};

beforeEach(() => {
  // Reset registry between tests. `installShareTokenProvider(null)`
  // is what the Bootstrap route-aware provider does when leaving
  // a public route, so this matches the real lifecycle.
  apiRegistry.installShareTokenProvider(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  apiRegistry.installShareTokenProvider(null);
});

/** Pull the headers map out of a `RequestInit`. `fetch`'s `headers` field
 *  can be a `Headers` instance, a plain object, or a tuple array, so
 *  we normalise to a `Record<string,string>` for assertions. */
const headersOf = (init: RequestInit): Record<string, string> => {
  const h = init.headers;
  if (!h) return {};
  if (h instanceof Headers) {
    const out: Record<string, string> = {};
    h.forEach((value, key) => {
      out[key] = value;
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

describe("NoteApi - per-instance (setShareTokenProvider directly)", () => {
  it("private mode: credentials: 'include', no Authorization", async () => {
    const api = new NoteApi();
    // No setShareTokenProvider call - default is no share token.
    const { url, init } = await api.requestInitForGet("note-1");

    expect(url).toBe(NOTE_PATH);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    const headers = headersOf(init);
    expect(headers.Authorization).toBeUndefined();
    expect(headers.Accept).toBe("application/json");
  });

  it("public mode: Authorization: Bearer <jwt>, credentials: 'omit'", async () => {
    const api = new NoteApi();
    api.setShareTokenProvider(() => "share-jwt-abc");

    const { url, init } = await api.requestInitForGet("note-1");

    expect(url).toBe(NOTE_PATH);
    expect(init.method).toBe("GET");
    // Switch to `credentials: "omit"` so no session cookie eats the
    // share header. If the "Authorization header not found" log
    // reappears, this test is the first place to look.
    expect(init.credentials).toBe("omit");
    const headers = headersOf(init);
    expect(headers.Authorization).toBe("Bearer share-jwt-abc");
    expect(headers.Accept).toBe("application/json");
  });

  it("re-fetches the token on every call (provider is a function, not a snapshot)", async () => {
    // Share JWT rotates via `useShareAccessToken`. Provider
    // contract: "function called per request", not "snapshot at
    // install time" -> pin that here.
    let current = "share-jwt-v1";
    const api = new NoteApi();
    api.setShareTokenProvider(() => current);

    const { init: init1 } = await api.requestInitForGet("note-1");
    expect(headersOf(init1).Authorization).toBe("Bearer share-jwt-v1");

    // Rotate the token, then re-fetch the init.
    current = "share-jwt-v2";
    const { init: init2 } = await api.requestInitForGet("note-1");
    expect(headersOf(init2).Authorization).toBe("Bearer share-jwt-v2");
  });

  it("treats a null-token provider as 'no share token' (back to include)", async () => {
    // `useShareAccessToken` sets token to null when shareId is empty.
    // Provider stays installed but returns null -> degrade gracefully.
    const api = new NoteApi();
    api.setShareTokenProvider(() => null);

    const { init } = await api.requestInitForGet("note-1");
    expect(init.credentials).toBe("include");
    expect(headersOf(init).Authorization).toBeUndefined();
  });

  it("the real get() call sends the right wire shape (verified via vi.mock('fetch'))", async () => {
    // Belt-and-braces: `requestInitForGet` is one path; the real
    // `get(id)` must hit `fetch()` with the same shape.
    const api = new NoteApi();
    api.setShareTokenProvider(() => "share-jwt-abc");
    const { calls } = mockFetchOk({ id: "note-1", title: "Hello" });

    const note = await api.get("note-1");
    expect(note?.title).toBe("Hello");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(NOTE_PATH);
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("omit");
    const headers = headersOf(calls[0].init);
    expect(headers.Authorization).toBe("Bearer share-jwt-abc");
  });
});

describe("NoteApi - private mode (registered singleton, no share provider)", () => {
  it("sends credentials: 'include' and no Authorization header on GET /api/notes/:id", async () => {
    // No share-token provider installed.
    const { url, init } = await getNoteApi().requestInitForGet("note-1");
    expect(url).toBe(NOTE_PATH);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    const headers = headersOf(init);
    expect(headers.Authorization).toBeUndefined();
  });

  it("the registered singleton is the same object as the broadcast-set instance", async () => {
    // The bug we just fixed: `apiRegistry.register(new NoteApi())`
    // and `apiRegistry.register(new NoteApi(), NOTE_API_TOKEN)`
    // made TWO instances. `installShareTokenProvider` iterated
    // the broadcast set (first instance) while `getNoteApi()`
    // returned the second. The result: the share token was
    // installed on an instance no one ever called, and the real
    // fetch went out without an Authorization header.
    //
    // We pin the contract by checking object identity.
    const fromToken = apiRegistry.get<NoteApi>(NOTE_API_TOKEN);
    const fromList = apiRegistry
      .list()
      .find((a): a is NoteApi => a instanceof NoteApi);
    expect(fromList).toBe(fromToken);
  });
});

describe("NoteApi - public mode (registered singleton, share provider installed)", () => {
  it("sends Authorization: Bearer <jwt> and credentials: 'omit' via the registered singleton", async () => {
    // Simulate the Bootstrap route-aware provider: when on
    // `/public/*`, the registry installs a provider that returns
    // the share JWT from zustand.
    apiRegistry.installShareTokenProvider(() => "share-jwt-abc");

    const { url, init } = await getNoteApi().requestInitForGet("note-1");
    expect(url).toBe(NOTE_PATH);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("omit");
    const headers = headersOf(init);
    expect(headers.Authorization).toBe("Bearer share-jwt-abc");
  });

  it("the registered singleton receives the share-token provider", async () => {
    // The wiring-level guarantee: the typed-token-registered
    // instance is the one the registry broadcasts to. If a future
    // refactor splits them again, this test fails loudly.
    apiRegistry.installShareTokenProvider(() => "share-jwt-abc");

    const { init } = await getNoteApi().requestInitForGet("note-1");
    expect(headersOf(init).Authorization).toBe("Bearer share-jwt-abc");
    expect(init.credentials).toBe("omit");
  });

  it("switches from include to omit as the share-token provider flips on", async () => {
    const before = await getNoteApi().requestInitForGet("note-1");
    expect(before.init.credentials).toBe("include");

    apiRegistry.installShareTokenProvider(() => "share-jwt-abc");
    const after = await getNoteApi().requestInitForGet("note-1");
    expect(after.init.credentials).toBe("omit");
    expect(headersOf(after.init).Authorization).toBe("Bearer share-jwt-abc");
  });

  it("falls back to include when the share-token provider is uninstalled", async () => {
    // `apiRegistry.installShareTokenProvider(null)` is what
    // Bootstrap's `useShareTokenMode` does when leaving a public
    // route. Make sure the API follows.
    apiRegistry.installShareTokenProvider(() => "share-jwt-abc");
    apiRegistry.installShareTokenProvider(null);

    const { init } = await getNoteApi().requestInitForGet("note-1");
    expect(init.credentials).toBe("include");
    expect(headersOf(init).Authorization).toBeUndefined();
  });

  it("the real get() call on the registered singleton sends the share header (verified via vi.mock('fetch'))", async () => {
    apiRegistry.installShareTokenProvider(() => "share-jwt-abc");
    const { calls } = mockFetchOk({ id: "note-1", title: "Hello" });

    const note = await getNoteApi().get("note-1");
    expect(note?.title).toBe("Hello");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(NOTE_PATH);
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("omit");
    const headers = headersOf(calls[0].init);
    expect(headers.Authorization).toBe("Bearer share-jwt-abc");
  });
});
