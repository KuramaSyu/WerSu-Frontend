// Tier 1 tests for `PasskeyApi`. Pins the URL shape + HTTP method of
// every ceremony endpoint so a future refactor that drops the `/api/`
// prefix or the trailing `/begin`/`/finish` segments fails loudly.
//
// The wire shape for the WebAuthn fields is intentionally covered by
// the hook tests in `usePasskeyCeremony.test.ts` (separate file) so
// this file stays focused on transport.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RestPasskeyApi } from "./PasskeyApi";

type FetchCall = {
  url: string;
  init: RequestInit;
};

const mockFetch = (response: unknown = {}) => {
  const calls: FetchCall[] = [];
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => response,
      text: async () => JSON.stringify(response),
    } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return { spy, calls };
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RestPasskeyApi - registration ceremony", () => {
  it("registerBegin posts to /api/auth/passkey/register/begin", async () => {
    const { calls } = mockFetch({
      challenge: "x",
      rp_id: "rp",
      rp_name: "WerSu",
    });
    const api = new RestPasskeyApi();
    await api.registerBegin();
    expect(calls[0].url).toMatch(/\/api\/auth\/passkey\/register\/begin$/);
    expect(calls[0].init.method).toBe("POST");
  });

  it("registerBegin sends the username hint when provided", async () => {
    const { calls } = mockFetch({});
    const api = new RestPasskeyApi();
    await api.registerBegin({ username: "alice" });
    expect(calls[0].init.body).toBe(JSON.stringify({ username: "alice" }));
  });

  it("registerFinish posts to /api/auth/passkey/register/finish", async () => {
    const { calls } = mockFetch({ credential_id: "abc" });
    const api = new RestPasskeyApi();
    await api.registerFinish({
      credential_id: [1, 2, 3],
      client_data_json: [4, 5],
      authenticator_data: [6, 7],
      signature: [],
    });
    expect(calls[0].url).toMatch(/\/api\/auth\/passkey\/register\/finish$/);
    expect(calls[0].init.method).toBe("POST");
  });
});

describe("RestPasskeyApi - login ceremony", () => {
  it("loginBegin posts to /api/auth/passkey/login/begin", async () => {
    const { calls } = mockFetch({
      challenge: "y",
      rp_id: "rp",
      rp_name: "WerSu",
    });
    const api = new RestPasskeyApi();
    await api.loginBegin();
    expect(calls[0].url).toMatch(/\/api\/auth\/passkey\/login\/begin$/);
    expect(calls[0].init.method).toBe("POST");
  });

  it("loginFinish posts to /api/auth/passkey/login/finish", async () => {
    const { calls } = mockFetch({
      id: "u1",
      username: "alice",
      is_active: true,
    });
    const api = new RestPasskeyApi();
    await api.loginFinish({
      credential_id: [1],
      client_data_json: [2],
      authenticator_data: [3],
      signature: [4],
    });
    expect(calls[0].url).toMatch(/\/api\/auth\/passkey\/login\/finish$/);
    expect(calls[0].init.method).toBe("POST");
  });
});

describe("RestPasskeyApi - link ceremony", () => {
  it("linkBegin posts to /api/auth/link/passkey/begin", async () => {
    const { calls } = mockFetch({
      challenge: "z",
      rp_id: "rp",
      rp_name: "WerSu",
    });
    const api = new RestPasskeyApi();
    await api.linkBegin();
    expect(calls[0].url).toMatch(/\/api\/auth\/link\/passkey\/begin$/);
    expect(calls[0].init.method).toBe("POST");
  });

  it("linkFinish posts to /api/auth/link/passkey/finish", async () => {
    const { calls } = mockFetch({ credential_id: "xyz" });
    const api = new RestPasskeyApi();
    await api.linkFinish({
      credential_id: [9],
      client_data_json: [8],
      authenticator_data: [7],
      signature: [],
    });
    expect(calls[0].url).toMatch(/\/api\/auth\/link\/passkey\/finish$/);
    expect(calls[0].init.method).toBe("POST");
  });
});
