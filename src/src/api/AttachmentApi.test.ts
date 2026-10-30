// Tier 1 tests for `GET /api/attachments/token`.
//
// Pins the wire shape used by the live-collab "missing JWT" rescue:
// - private / logged-in: session cookie (`credentials: "include"`),
//   no Authorization header.
// - public share: `Authorization: Bearer <share-jwt>` and
//   `credentials: "omit"` (so the cookie doesn't swallow the bearer).
//
// Also pins that the `key` is URL-encoded and the `{ token }` body is
// unwrapped, with non-ok responses resolving to `null`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentApi } from "./AttachmentApi";

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

const mockFetch = (
  response: Partial<Response> & { json?: () => Promise<unknown> },
) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      ...response,
    } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return { spy, calls };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AttachmentApi.getAttachmentToken", () => {
  it("private mode: credentials: 'include', no Authorization, key URL-encoded", async () => {
    const { calls } = mockFetch({ json: async () => ({ token: "jwt-1" }) });
    const api = new AttachmentApi();

    const token = await api.getAttachmentToken("dir/img one.png");

    expect(token).toBe("jwt-1");
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toContain("/api/attachments/token?key=");
    // URLSearchParams-style encoding of a bare path segment: spaces -> %20? encodeURIComponent gives %20 for space.
    expect(url).toContain("dir%2Fimg%20one.png");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect(headersOf(init).Authorization).toBeUndefined();
  });

  it("public mode: Authorization: Bearer <jwt>, credentials: 'omit'", async () => {
    const { calls } = mockFetch({ json: async () => ({ token: "jwt-2" }) });
    const api = new AttachmentApi();
    api.setShareTokenProvider(() => "share-jwt-abc");

    const token = await api.getAttachmentToken("att-1");

    expect(token).toBe("jwt-2");
    const { init } = calls[0];
    expect(init.credentials).toBe("omit");
    expect(headersOf(init).Authorization).toBe("Bearer share-jwt-abc");
  });

  it("returns null on a non-ok response", async () => {
    mockFetch({ ok: false, status: 403, json: async () => ({}) });
    const api = new AttachmentApi();
    expect(await api.getAttachmentToken("att-1")).toBeNull();
  });

  it("returns null when the body has no token", async () => {
    mockFetch({ json: async () => ({}) });
    const api = new AttachmentApi();
    expect(await api.getAttachmentToken("att-1")).toBeNull();
  });
});

// Metadata is fetched for the attachment rail and the preview modal. On a
// public share the session cookie is absent, so the request must carry the
// share JWT as `Authorization: Bearer` (and omit the cookie) or the backend
// answers 401 before the handler runs.
describe("AttachmentApi.getAttachmentMetadata share auth", () => {
  it("attaches the share bearer token and omits cookies in public mode", async () => {
    const { calls } = mockFetch({
      json: async () => ({
        key: "attachments/att-1",
        filename: "a.png",
        content_type: "image/png",
        size: 1,
        created_at: "2026-01-01T00:00:00Z",
      }),
    });
    const api = new AttachmentApi();
    api.setShareTokenProvider(() => "share-jwt-abc");

    await api.getAttachmentMetadata("attachments/att-1");

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toContain("/api/attachments/metadata/");
    expect(url).toContain("key=attachments%2Fatt-1");
    expect(init.credentials).toBe("omit");
    expect(headersOf(init).Authorization).toBe("Bearer share-jwt-abc");
  });

  it("keeps session cookies when no share provider is installed", async () => {
    const { calls } = mockFetch({
      json: async () => ({
        key: "att-1",
        filename: "a.png",
        content_type: "image/png",
        size: 1,
        created_at: "2026-01-01T00:00:00Z",
      }),
    });
    const api = new AttachmentApi();

    await api.getAttachmentMetadata("att-1");

    expect(calls[0].init.credentials).toBe("include");
    expect(headersOf(calls[0].init).Authorization).toBeUndefined();
  });
});
