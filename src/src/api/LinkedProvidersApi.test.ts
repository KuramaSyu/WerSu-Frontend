// Tier 1 tests for LinkedProvidersApi.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedProvidersApi } from "./LinkedProvidersApi";

type FetchCall = { url: string; init: RequestInit };

const mockFetch = (response: unknown) => {
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

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("LinkedProvidersApi.getLinkedCredentials", () => {
  it("GETs /api/auth/me/credentials with include credentials", async () => {
    const { calls } = mockFetch({
      credentials: [{ kind: "discord", identifier: "123" }],
      passkeys: [],
    });
    const api = new LinkedProvidersApi();
    await api.getLinkedCredentials();
    expect(calls[0].url).toMatch(/\/api\/auth\/me\/credentials$/);
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("include");
  });
});

describe("LinkedProvidersApi registration", () => {
  it("uses the api registry singleton", async () => {
    const { apiRegistry } = await import("./apiRegistry");
    const { LINKED_PROVIDERS_API_TOKEN } = await import("./LinkedProvidersApi");
    const resolved = apiRegistry.get(LINKED_PROVIDERS_API_TOKEN);
    expect(resolved).toBeInstanceOf(LinkedProvidersApi);
  });
});
