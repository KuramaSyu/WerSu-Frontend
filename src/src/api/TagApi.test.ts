import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagApi } from "./TagApi";
import { apiRegistry } from "./apiRegistry";

interface Call {
  url: string;
  init: RequestInit;
}

const mockFetch = (body: unknown, ok = true, status = 200) => {
  const calls: Call[] = [];
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return calls;
};

beforeEach(() => {
  apiRegistry.installShareTokenProvider(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  apiRegistry.installShareTokenProvider(null);
});

describe("TagApi.list", () => {
  it("hits GET /api/tags", async () => {
    const api = new TagApi();
    const calls = mockFetch([{ id: "tag-1", slug: "ideas", display_name: "Ideas" }]);

    const tags = await api.list();

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).pathname).toBe("/api/tags");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("include");
    expect(tags).toEqual([{ id: "tag-1", slug: "ideas", display_name: "Ideas" }]);
  });

  it("throws a UserError when the server rejects the list", async () => {
    const api = new TagApi();
    mockFetch({ error: "forbidden" }, false, 403);

    await expect(api.list()).rejects.toMatchObject({
      name: "UserError",
      status: 403,
    });
  });
});

describe("TagApi.get", () => {
  it("URL-encodes the tag id", async () => {
    const api = new TagApi();
    const calls = mockFetch({ id: "tag/x", slug: "x", display_name: "X" });

    await api.get("tag/x");

    expect(new URL(calls[0].url).pathname).toBe("/api/tags/tag%2Fx");
  });

  it("returns undefined for a 404", async () => {
    const api = new TagApi();
    mockFetch({ error: "missing" }, false, 404);

    await expect(api.get("tag-1")).resolves.toBeUndefined();
  });
});

describe("TagApi writes", () => {
  it("POST /api/tags sends the create payload", async () => {
    const api = new TagApi();
    const calls = mockFetch({ id: "tag-2", slug: "work", display_name: "Work" });

    await api.create({ slug: "work", display_name: "Work" });

    expect(new URL(calls[0].url).pathname).toBe("/api/tags");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      slug: "work",
      display_name: "Work",
    });
  });

  it("PATCH /api/tags/:id sends the update payload", async () => {
    const api = new TagApi();
    const calls = mockFetch({ id: "tag-2", slug: "work", display_name: "Work" });

    await api.patch("tag-2", { display_name: "Work" });

    expect(new URL(calls[0].url).pathname).toBe("/api/tags/tag-2");
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ display_name: "Work" });
  });

  it("DELETE /api/tags/:id resolves the deleted flag", async () => {
    const api = new TagApi();
    const calls = mockFetch({ deleted: true });

    await expect(api.delete("tag-2")).resolves.toBe(true);
    expect(new URL(calls[0].url).pathname).toBe("/api/tags/tag-2");
    expect(calls[0].init.method).toBe("DELETE");
  });
});
