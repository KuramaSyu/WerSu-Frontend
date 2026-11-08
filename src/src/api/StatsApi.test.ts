// Tier 1 tests pinning the wire shape of the precomputed stats endpoints.
// URL drift is the usual source of "why is my stats fetch 404" bugs, so the
// assertions below check the exact paths and HTTP method.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatsApi } from "./StatsApi";
import { ApiError } from "./SharingApi";
import { apiRegistry } from "./apiRegistry";
import type { CalculatedStatsReply } from "./models/stats";

const statsReply: CalculatedStatsReply = {
  user_id: "0195f8f4-1167-7f89-b5ec-b40a8f08f4cb",
  total_chars: 12345,
  total_notes: 42,
  total_chapters: 7,
  total_books: 2,
  calculated_at: "2026-04-08T00:00:00Z",
};

const mockFetchOk = (body: unknown = statsReply) => {
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

const mockFetchNotOk = (status: number, body: unknown = { error: "nope" }) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: false,
      status,
      statusText: "Error",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return { spy, calls };
};

beforeEach(() => {
  apiRegistry.installShareTokenProvider(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  apiRegistry.installShareTokenProvider(null);
});

describe("StatsApi.getStats", () => {
  it("GETs /api/stats with credentials", async () => {
    const api = new StatsApi();
    const { calls } = mockFetchOk();

    const reply = await api.getStats();

    expect(reply).toEqual(statsReply);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).pathname).toBe("/api/stats");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("include");
  });

  it("throws ApiError on non-OK responses", async () => {
    const api = new StatsApi();
    mockFetchNotOk(404, { message: "stats not found" });

    await expect(api.getStats()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("StatsApi.getStatsForUser", () => {
  it("GETs /api/stats/:user_id with an encoded id", async () => {
    const api = new StatsApi();
    const { calls } = mockFetchOk();

    const reply = await api.getStatsForUser("user/with/slash");

    expect(reply).toEqual(statsReply);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).pathname).toBe(
      "/api/stats/user%2Fwith%2Fslash",
    );
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("include");
  });

  it("throws ApiError when the caller lacks access", async () => {
    const api = new StatsApi();
    mockFetchNotOk(403, { message: "forbidden" });

    await expect(api.getStatsForUser("other-user")).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
