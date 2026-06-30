// Tier 1 tests for the public/private split of `SharingApi`.
//
// These tests pin the URL shape of every endpoint in the new
// `RestSharingApi` (private CRUD) and `RestPublicSharingApi` (public
// grant + JWT) implementations. URL drift is the #1 source of "why
// is my fetch 404" bugs in this codebase, so the tests fetch the
// exact path that's wired up rather than asserting on whether
// specific `fetch` overloads are matched.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RestPublicSharingApi, RestSharingApi } from "./SharingApi";

type FetchCall = {
  url: string;
  init: RequestInit;
};

const mockFetch = (
  response: unknown = {},
  options: { ok?: boolean; status?: number } = {},
) => {
  const { ok = true, status = 200 } = options;
  const calls: FetchCall[] = [];
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok,
      status,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => response,
      text: async () => JSON.stringify(response),
    } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return { spy, calls };
};

beforeEach(() => {
  // Make sure tests don't leak the stub between cases.
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RestSharingApi (private CRUD)", () => {
  it("createShare posts to /api/shares", async () => {
    const { calls } = mockFetch({ id: "s1" });
    const api = new RestSharingApi();
    await api.createShare({ share: { note_id: "n1", permission: "READ" } });
    expect(calls[0].url).toMatch(/\/api\/shares$/);
    expect(calls[0].url).not.toMatch(/\/public\//);
    expect(calls[0].init.method).toBe("POST");
  });

  it("updateShare patches /api/shares", async () => {
    const { calls } = mockFetch({ id: "s1" });
    const api = new RestSharingApi();
    await api.updateShare({
      share: { id: "s1", note_id: "n1", permission: "READ" },
    });
    expect(calls[0].url).toMatch(/\/api\/shares$/);
    expect(calls[0].init.method).toBe("PATCH");
  });

  it("getShares lists /api/shares", async () => {
    const { calls } = mockFetch([]);
    const api = new RestSharingApi();
    await api.getShares({ note_id: "n1" });
    expect(calls[0].url).toMatch(/\/api\/shares\?/);
    expect(calls[0].init.method).toBe("GET");
  });

  it("getShareById hits /api/shares/:id", async () => {
    const { calls } = mockFetch({ id: "s1" });
    const api = new RestSharingApi();
    await api.getShareById({ id: "s1" });
    expect(calls[0].url).toMatch(/\/api\/shares\/s1$/);
    expect(calls[0].init.method).toBe("GET");
  });

  it("getSharesById hits /api/shares/by-id", async () => {
    const { calls } = mockFetch([]);
    const api = new RestSharingApi();
    await api.getSharesById({ share_ids: ["s1", "s2"] });
    expect(calls[0].url).toMatch(/\/api\/shares\/by-id\?/);
    expect(calls[0].init.method).toBe("GET");
  });

  it("deleteShares hits /api/shares via DELETE", async () => {
    const { calls } = mockFetch(undefined);
    const api = new RestSharingApi();
    await api.deleteShares({ share_ids: ["s1"] });
    expect(calls[0].url).toMatch(/\/api\/shares$/);
    expect(calls[0].init.method).toBe("DELETE");
  });
});

describe("RestPublicSharingApi (public grant + JWT)", () => {
  it("getPublicShare hits the public grant endpoint, NOT the authenticated list", async () => {
    // The original bug: `usePublicShare` was wired to
    // `GET /api/shares?share_id=...` (the authenticated list
    // endpoint), which silently 400s for a public share. This test
    // pins the path so a refactor that re-introduces that mistake
    // fails loudly.
    const { calls } = mockFetch({ note_id: "n1", permission: "READ" });
    const api = new RestPublicSharingApi();
    await api.getPublicShare({ share_id: "share-abc" });

    expect(calls).toHaveLength(1);
    // Must hit the public grant, not the authenticated list.
    expect(calls[0].url).toMatch(/\/api\/shares\/public\//);
    // The path must end with `/public/?share_id=...` - the trailing
    // slash before the query string is what distinguishes it from
    // `/api/shares?share_id=...`.
    expect(calls[0].url).toMatch(
      /\/api\/shares\/public\/\?share_id=share-abc$/,
    );
    // Belt-and-braces: the URL must NOT match the bare
    // authenticated list shape.
    expect(calls[0].url).not.toMatch(/\/api\/shares\?(?!.*\/public)/);
    expect(calls[0].init.method).toBe("GET");
  });

  it("getPublicShare does not send user cookies (no `credentials: include`)", async () => {
    // The public grant is intentionally unauthenticated. If a
    // future refactor adds `credentials: "include"` and the
    // browser's cookie jar contains a stale session cookie, the
    // server might attach it and leak identity.
    const { calls } = mockFetch({});
    const api = new RestPublicSharingApi();
    await api.getPublicShare({ share_id: "share-abc" });
    expect(calls[0].init.credentials).not.toBe("include");
  });

  it("fetchPublicAccessToken posts to /api/auth/public-access-token", async () => {
    const { calls } = mockFetch({ token: "jwt" });
    const api = new RestPublicSharingApi();
    await api.fetchPublicAccessToken("share-abc");

    expect(calls[0].url).toMatch(/\/api\/auth\/public-access-token$/);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe(JSON.stringify({ share_id: "share-abc" }));
  });
});
