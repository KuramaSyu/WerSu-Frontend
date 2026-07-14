// Tier 1 tests pinning the wire shape of
// `GET /api/directories/:id/notes/?limit=...&offset=...`.
//
// URL drift is the #1 source of "why is my fetch 404" bugs in this
// codebase, so the assertion is exact.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DirectoryApi } from "./DirectoryApi";
import { apiRegistry } from "./apiRegistry";

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

const mockFetchNotOk = (status: number, statusText = "Not Found") => {
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

beforeEach(() => {
  apiRegistry.installShareTokenProvider(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  apiRegistry.installShareTokenProvider(null);
});

describe("DirectoryApi.listNotes - URL shape", () => {
  it("hits /api/directories/:id/notes/ with no query params when none supplied", async () => {
    const api = new DirectoryApi();
    const { calls } = mockFetchOk([]);

    const reply = await api.listNotes("dir-1");
    expect(reply).toEqual({ notes: [], directories: [], tags: [] });
    expect(calls).toHaveLength(1);
    // No trailing slash: gin routes `/notes` and redirects `/notes/`.
    // A 301 response is missing CORS headers, so the browser refuses to
    // follow it cross-origin. We send the canonical form directly.
    expect(calls[0].url).toMatch(/\/api\/directories\/dir-1\/notes(\?|$)/);
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("include");
  });

  it("appends limit and offset query params", async () => {
    const api = new DirectoryApi();
    const { calls } = mockFetchOk([]);

    await api.listNotes("dir-1", { limit: 25, offset: 50 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(
      /\/api\/directories\/dir-1\/notes\?limit=25&offset=50$/,
    );
  });

  it("encodes directory ids that contain special characters", async () => {
    const api = new DirectoryApi();
    const { calls } = mockFetchOk([]);

    await api.listNotes("dir/with/slash");
    expect(calls[0].url).toMatch(
      /\/api\/directories\/dir%2Fwith%2Fslash\/notes(\?|$)/,
    );
  });

  it("returns NotesReply parsed from the response body", async () => {
    const api = new DirectoryApi();
    const body = {
      notes: [
        {
          id: "n-1",
          title: "README.md",
          author_id: "u-1",
          updated_at: "2026-07-05T00:00:00Z",
          stripped_content: "# full readme content here",
          directory_ids: ["dir-1"],
          tag_ids: [],
        },
        {
          id: "n-2",
          title: "Regular note",
          author_id: "u-1",
          updated_at: "2026-07-04T00:00:00Z",
          stripped_content: "stripped preview",
          directory_ids: ["dir-1"],
          tag_ids: [],
        },
      ],
      directories: [
        {
          id: "dir-1",
          display_name: "Stacks",
        },
      ],
      tags: [],
    };
    const { calls } = mockFetchOk(body);

    const reply = await api.listNotes("dir-1");
    expect(reply).toEqual(body);
    expect(calls[0].url).toMatch(/\/api\/directories\/dir-1\/notes(\?|$)/);
  });

  it("returns an empty NotesReply on non-OK responses (no throw)", async () => {
    // Same error policy as `list()`: degraded quietly, not surfaced.
    // The consumer (DirectoryEdit) shows an empty textbox when the
    // directory has no README yet.
    const api = new DirectoryApi();
    const { calls } = mockFetchNotOk(404);

    const reply = await api.listNotes("dir-1");
    expect(reply).toEqual({ notes: [], directories: [], tags: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/directories\/dir-1\/notes(\?|$)/);
  });
});

describe("DirectoryApi.list - URL shape", () => {
  // Tier 1 test pinning the wire shape of `GET /api/directories?...`.
  // The `include_*` query flags are required by the backend now and
  // must always be sent (with sensible defaults) so the response
  // carries the parent and child ids the hierarchy builder needs.

  it("sends include_parents=true, include_child_dirs=true, include_child_notes=false by default", async () => {
    const api = new DirectoryApi();
    const { calls } = mockFetchOk([]);

    await api.list();
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/api/directories");
    expect(url.searchParams.get("include_parents")).toBe("true");
    expect(url.searchParams.get("include_child_dirs")).toBe("true");
    expect(url.searchParams.get("include_child_notes")).toBe("false");
  });

  it("forwards caller overrides for the include_* flags", async () => {
    const api = new DirectoryApi();
    const { calls } = mockFetchOk([]);

    await api.list({
      include_parents: false,
      include_child_dirs: false,
      include_child_notes: true,
    });
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("include_parents")).toBe("false");
    expect(url.searchParams.get("include_child_dirs")).toBe("false");
    expect(url.searchParams.get("include_child_notes")).toBe("true");
  });

  it("appends parent_id alongside the include_* flags", async () => {
    const api = new DirectoryApi();
    const { calls } = mockFetchOk([]);

    await api.list({ parent_id: "dir-9" });
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("parent_id")).toBe("dir-9");
    expect(url.searchParams.get("include_parents")).toBe("true");
    expect(url.searchParams.get("include_child_dirs")).toBe("true");
    expect(url.searchParams.get("include_child_notes")).toBe("false");
  });
});
