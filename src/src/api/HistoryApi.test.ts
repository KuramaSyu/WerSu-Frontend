// Tier 1 tests pinning the wire shape of `GET /api/history` for
// both `mode=history` and `mode=most_used`. URL drift is the #1
// source of "why is my fetch 404" bugs in this codebase, so the
// assertion is exact.
//
// Wire shape pinned:
// - URL root is `/api/history`.
// - `mode` is appended (and never absent when called via the
//   typed methods).
// - Repeated `actions` show up as multiple `actions=` keys.
// - Bearer / cookie auth path matches `NoteApi`'s policy.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryApi, getHistoryApi, HISTORY_API_TOKEN } from "./HistoryApi";
import { apiRegistry } from "./apiRegistry";
import type { HistoryFilter } from "./models/history";

const HISTORY_BASE = "http://localhost:8080/api/history";

const mockFetchOk = (body: unknown = []) => {
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

const mockFetchNotOk = (
  status: number,
  statusText = "Internal Server Error",
) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: false,
      status,
      statusText,
      headers: new Headers(),
      json: async () => ({}),
      text: async () => statusText,
    } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return { spy, calls };
};

/** Pull the headers map out of a `RequestInit`. */
const headersOf = (init: RequestInit): Record<string, string> => {
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

/** Parse the query string of a URL into a Map (allows multi-value keys). */
const parseQuery = (url: string): Map<string, string[]> => {
  const search = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const out = new Map<string, string[]>();
  for (const pair of search.split("&").filter(Boolean)) {
    const [k, v = ""] = pair.split("=");
    const decodedKey = decodeURIComponent(k);
    const decodedVal = decodeURIComponent(v);
    const list = out.get(decodedKey) ?? [];
    list.push(decodedVal);
    out.set(decodedKey, list);
  }
  return out;
};

beforeEach(() => {
  apiRegistry.installShareTokenProvider(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  apiRegistry.installShareTokenProvider(null);
});

const baseHistoryFilter = (): HistoryFilter => ({ mode: "history" });
const baseMostUsedFilter = (): HistoryFilter => ({ mode: "most_used" });

describe("HistoryApi.getActivityHistory - URL shape", () => {
  it("hits /api/history?mode=history with a minimal filter", async () => {
    const api = new HistoryApi();
    const { calls } = mockFetchOk([]);

    const rows = await api.getActivityHistory(baseHistoryFilter());
    expect(rows).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(
      new RegExp(`^${HISTORY_BASE}\\?mode=history$`),
    );
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("include");
  });

  it("appends scalar filters to the query string", async () => {
    const api = new HistoryApi();
    const { calls } = mockFetchOk([]);

    await api.getActivityHistory({
      mode: "history",
      note_id: "note-1",
      directory_id: "dir-1",
      actor_id: "user-1",
      role_id: "role-1",
      accessed_as: "ACCESSED_AS_USER",
      days: 30,
      limit: 50,
      offset: 10,
    });

    expect(calls).toHaveLength(1);
    const q = parseQuery(calls[0].url);
    expect(q.get("mode")).toEqual(["history"]);
    expect(q.get("note_id")).toEqual(["note-1"]);
    expect(q.get("directory_id")).toEqual(["dir-1"]);
    expect(q.get("actor_id")).toEqual(["user-1"]);
    expect(q.get("role_id")).toEqual(["role-1"]);
    expect(q.get("accessed_as")).toEqual(["ACCESSED_AS_USER"]);
    expect(q.get("days")).toEqual(["30"]);
    expect(q.get("limit")).toEqual(["50"]);
    expect(q.get("offset")).toEqual(["10"]);
    // Wire only carries `most_used` -> algorithm/unique_per_day;
    // absent for `history` mode.
    expect(q.has("algorithm")).toBe(false);
    expect(q.has("unique_per_day")).toBe(false);
  });

  it("appends repeated actions keys for action_set", async () => {
    const api = new HistoryApi();
    const { calls } = mockFetchOk([]);

    await api.getActivityHistory({
      mode: "history",
      actions: ["note_viewed", "note_created", "note_edited"],
    });

    expect(calls).toHaveLength(1);
    const q = parseQuery(calls[0].url);
    // Three separate `actions=` keys (order is preserved by
    // `toQueryString`, which appends for arrays).
    expect(q.get("actions")).toEqual([
      "note_viewed",
      "note_created",
      "note_edited",
    ]);
    expect(q.get("mode")).toEqual(["history"]);
  });

  it("pins mode=history even when the filter has another mode", async () => {
    // Defensive: a caller that passes a stale `most_used` filter
    // into `getActivityHistory` should not silently hit the wrong
    // backend code path. The typed method forces `mode=history`.
    const api = new HistoryApi();
    const { calls } = mockFetchOk([]);

    await api.getActivityHistory({ mode: "most_used" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/mode=history/);
    expect(calls[0].url).not.toMatch(/mode=most_used/);
  });
});

describe("HistoryApi.getMostUsed - URL shape", () => {
  it("hits /api/history?mode=most_used", async () => {
    const api = new HistoryApi();
    const { calls } = mockFetchOk([]);

    const scores = await api.getMostUsed(baseMostUsedFilter());
    expect(scores).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(
      new RegExp(`^${HISTORY_BASE}\\?mode=most_used$`),
    );
  });

  it("appends algorithm and unique_per_day", async () => {
    const api = new HistoryApi();
    const { calls } = mockFetchOk([]);

    await api.getMostUsed({
      mode: "most_used",
      algorithm: "MOST_USED_ALGORITHM_LOG_COUNT",
      unique_per_day: true,
      directory_id: "dir-1",
      days: 30,
    });
    expect(calls).toHaveLength(1);
    const q = parseQuery(calls[0].url);
    expect(q.get("mode")).toEqual(["most_used"]);
    expect(q.get("algorithm")).toEqual(["MOST_USED_ALGORITHM_LOG_COUNT"]);
    expect(q.get("unique_per_day")).toEqual(["true"]);
    expect(q.get("directory_id")).toEqual(["dir-1"]);
    expect(q.get("days")).toEqual(["30"]);
  });

  it("pins mode=most_used even when the filter has another mode", async () => {
    const api = new HistoryApi();
    const { calls } = mockFetchOk([]);

    await api.getMostUsed({ mode: "history" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/mode=most_used/);
    expect(calls[0].url).not.toMatch(/mode=history(&|$)/);
  });
});

describe("HistoryApi - response shape", () => {
  it("returns ActivityReply[] when the backend sends rows", async () => {
    const api = new HistoryApi();
    const body = [
      {
        id: "ev-1",
        actor_id: "u-1",
        accessed_as: "ACCESSED_AS_USER",
        action: "note_edited",
        note_id: "n-1",
        directory_id: "",
        role_id: "",
        at: "2026-07-06T12:34:56Z",
        metadata_json: "{}",
      },
    ];
    const { calls } = mockFetchOk(body);

    const rows = await api.getActivityHistory(baseHistoryFilter());
    expect(rows).toEqual(body);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/mode=history/);
  });

  it("returns ActivityScoreReply[] when the backend sends scores", async () => {
    const api = new HistoryApi();
    const body = [
      { note_id: "n-1", score: 12.5 },
      { note_id: "n-2", score: 7 },
    ];
    const { calls } = mockFetchOk(body);

    const scores = await api.getMostUsed(baseMostUsedFilter());
    expect(scores).toEqual(body);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/mode=most_used/);
  });

  it("returns [] on non-OK responses (no throw)", async () => {
    // Matches existing `ActivityApi` policy: degrade quietly so
    // the panel can show an empty state without a hard error.
    const api = new HistoryApi();
    const { calls } = mockFetchNotOk(500);

    const rows = await api.getActivityHistory(baseHistoryFilter());
    expect(rows).toEqual([]);
    expect(calls).toHaveLength(1);

    const { calls: calls2 } = mockFetchNotOk(403);
    const scores = await api.getMostUsed(baseMostUsedFilter());
    expect(scores).toEqual([]);
    expect(calls2).toHaveLength(1);
  });
});

describe("HistoryApi - auth path (registered singleton)", () => {
  it("private mode: credentials: 'include', no Authorization", async () => {
    // No share-token provider installed. Drive a real request
    // through the registered instance to assert the wire shape
    // end-to-end (not just `getFetchParameters`).
    const api = getHistoryApi();
    const { calls } = mockFetchOk([]);

    await api.getActivityHistory(baseHistoryFilter());

    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("include");
    expect(headersOf(calls[0].init).Authorization).toBeUndefined();
  });

  it("public mode: Authorization: Bearer <jwt>, credentials: 'omit'", async () => {
    apiRegistry.installShareTokenProvider(() => "share-jwt-abc");
    const api = getHistoryApi();
    const { calls } = mockFetchOk([]);

    await api.getActivityHistory(baseHistoryFilter());

    expect(calls).toHaveLength(1);
    expect(calls[0].init.credentials).toBe("omit");
    expect(headersOf(calls[0].init).Authorization).toBe("Bearer share-jwt-abc");
  });

  it("the registered singleton is the broadcast-set instance", async () => {
    // Same bug history as `NoteApi`: a fresh `new HistoryApi()`
    // and the typed-token instance would diverge. Pin identity.
    const fromToken = apiRegistry.get<HistoryApi>(HISTORY_API_TOKEN);
    const fromList = apiRegistry
      .list()
      .find((a): a is HistoryApi => a instanceof HistoryApi);
    expect(fromList).toBe(fromToken);
  });
});
