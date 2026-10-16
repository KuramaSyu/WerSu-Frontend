// Tier 1 tests for UserManagementApi.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserManagementApi } from "./UserManagementApi";

type FetchCall = { url: string; init: RequestInit };

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

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

const SAMPLE_PASSWORD = "correct horse battery staple";

describe("UserManagementApi.createUser", () => {
  it("POSTs to /api/users with { email, username, password } as plaintext", async () => {
    const { calls } = mockFetch({ id: "u1" });
    const api = new UserManagementApi();
    await api.createUser({
      email: "alice@example.com",
      username: "alice",
      password: SAMPLE_PASSWORD,
    });
    expect(calls[0].url).toMatch(/\/api\/users$/);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.credentials).toBe("include");
    expect(calls[0].init.body).toBe(
      JSON.stringify({
        email: "alice@example.com",
        username: "alice",
        password: SAMPLE_PASSWORD,
      }),
    );
  });
});

describe("UserManagementApi.signup", () => {
  it("POSTs to /api/auth/signup with { username, email, password } as plaintext", async () => {
    const { calls } = mockFetch({ id: "u1", username: "alice" });
    const api = new UserManagementApi();
    await api.signup({
      username: "alice",
      email: "alice@example.com",
      password: SAMPLE_PASSWORD,
    });
    expect(calls[0].url).toMatch(/\/api\/auth\/signup$/);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.credentials).toBe("include");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      username: "alice",
      email: "alice@example.com",
      password: SAMPLE_PASSWORD,
    });
  });
});

describe("UserManagementApi.loginPassword", () => {
  it("POSTs to /api/auth/login with { kind: 'password', email, password } as plaintext", async () => {
    const { calls } = mockFetch({ id: "u1" });
    const api = new UserManagementApi();
    await api.loginPassword({
      kind: "password",
      email: "alice@example.com",
      password: SAMPLE_PASSWORD,
    });
    expect(calls[0].url).toMatch(/\/api\/auth\/login$/);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.credentials).toBe("include");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      kind: "password",
      email: "alice@example.com",
      password: SAMPLE_PASSWORD,
    });
  });
});

describe("UserManagementApi.patchUser", () => {
  it("PATCHes /api/users/{id} with the supplied payload", async () => {
    const { calls } = mockFetch({ id: "u1" });
    const api = new UserManagementApi();
    await api.patchUser("u1", { username: "alice2" });
    expect(calls[0].url).toMatch(/\/api\/users\/u1$/);
    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].init.body).toBe(JSON.stringify({ username: "alice2" }));
  });

  it("round-trips a clear-only payload", async () => {
    const { calls } = mockFetch({ id: "u1" });
    const api = new UserManagementApi();
    await api.patchUser("u1", { email_clear: true });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      email_clear: true,
    });
  });

  it("throws client-side when set and clear are supplied for the same field", async () => {
    const { spy } = mockFetch({ id: "u1" });
    const api = new UserManagementApi();
    await expect(
      api.patchUser("u1", { email: "x@x", email_clear: true }),
    ).rejects.toThrow(/mutually exclusive/);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("UserManagementApi.changePassword", () => {
  it("POSTs to /api/auth/password/change with { current, new_password } as plaintext", async () => {
    const { calls } = mockFetch(undefined, { status: 204 });
    const api = new UserManagementApi();
    await api.changePassword({
      current: SAMPLE_PASSWORD,
      new_password: "new-pw-1",
    });
    expect(calls[0].url).toMatch(/\/api\/auth\/password\/change$/);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.credentials).toBe("include");
    expect(calls[0].init.body).toBe(
      JSON.stringify({
        current: SAMPLE_PASSWORD,
        new_password: "new-pw-1",
      }),
    );
  });

  it("omits `current` from the body when it is not provided (set-password path)", async () => {
    const { calls } = mockFetch(undefined, { status: 204 });
    const api = new UserManagementApi();
    await api.changePassword({ new_password: "new-pw-1" });
    expect(calls[0].url).toMatch(/\/api\/auth\/password\/change$/);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      new_password: "new-pw-1",
    });
  });
});

describe("UserManagementApi registration", () => {
  it("uses the api registry singleton", async () => {
    const { apiRegistry } = await import("./apiRegistry");
    const { USER_MANAGEMENT_API_TOKEN } = await import("./UserManagementApi");
    const resolved = apiRegistry.get(USER_MANAGEMENT_API_TOKEN);
    expect(resolved).toBeInstanceOf(UserManagementApi);
  });
});
