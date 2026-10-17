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
      session_key: "sk",
      credential: {
        id: "abc",
        rawId: "AQID",
        type: "public-key",
        response: {
          clientDataJSON: "BAU",
          attestationObject: "Bgc",
          transports: ["internal"],
        },
        authenticatorAttachment: "platform",
        clientExtensionResults: {},
      },
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
      session_key: "sk",
      credential: {
        id: "abc",
        rawId: "AQ",
        type: "public-key",
        response: {
          clientDataJSON: "Ag",
          authenticatorData: "Aw",
          signature: "BA",
          userHandle: "BQ",
        },
      },
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
      session_key: "sk",
      friendly_name: "iPhone",
      credential: {
        id: "xyz",
        rawId: "CQ",
        type: "public-key",
        response: {
          clientDataJSON: "CA",
          attestationObject: "Bw",
        },
      },
    });
    expect(calls[0].url).toMatch(/\/api\/auth\/link\/passkey\/finish$/);
    expect(calls[0].init.method).toBe("POST");
  });
});

describe("RestPasskeyApi - list and revoke", () => {
  it("listPasskeys gets /api/auth/passkey/list with no query string by default", async () => {
    const { calls } = mockFetch({ passkeys: [] });
    const api = new RestPasskeyApi();
    await api.listPasskeys();
    expect(calls[0].url).toMatch(/\/api\/auth\/passkey\/list$/);
    expect(calls[0].init.method).toBe("GET");
    // No body, no query string for the default (revoked excluded) call.
    expect(calls[0].init.body).toBeUndefined();
  });

  it("listPasskeys appends include_revoked=true when requested", async () => {
    const { calls } = mockFetch({ passkeys: [] });
    const api = new RestPasskeyApi();
    await api.listPasskeys({ include_revoked: true });
    expect(calls[0].url).toMatch(
      /\/api\/auth\/passkey\/list\?include_revoked=true$/,
    );
  });

  it("listPasskeys omits the query string for include_revoked=false (default)", async () => {
    const { calls } = mockFetch({ passkeys: [] });
    const api = new RestPasskeyApi();
    await api.listPasskeys({ include_revoked: false });
    expect(calls[0].url).not.toMatch(/\?/);
  });

  it("revokePasskey sends DELETE to /api/auth/passkey/{id}", async () => {
    const { calls } = mockFetch({});
    const api = new RestPasskeyApi();
    await api.revokePasskey({ id: "pk_abc123" });
    expect(calls[0].url).toMatch(/\/api\/auth\/passkey\/pk_abc123$/);
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("revokePasskey percent-encodes ids that contain characters needing escaping", async () => {
    const { calls } = mockFetch({});
    const api = new RestPasskeyApi();
    await api.revokePasskey({ id: "pk/with space" });
    expect(calls[0].url).toMatch(/\/api\/auth\/passkey\/pk%2Fwith%20space$/);
    expect(calls[0].init.method).toBe("DELETE");
  });
});
