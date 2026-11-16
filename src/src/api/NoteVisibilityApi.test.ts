// Wire-shape tests for the note visibility REST client.
//
// The backend endpoint is not live yet, so URL and body drift are pinned
// here. A future implementation can keep these assertions as its contract.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildHideVisibilityRequest, RestNoteVisibilityApi } from "./NoteVisibilityApi";
import { apiRegistry } from "./apiRegistry";
import { NoteVisibilityScope, resolveVisibilityExpiry } from "./models/noteVisibility";

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

beforeEach(() => {
  apiRegistry.installShareTokenProvider(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("RestNoteVisibilityApi", () => {
  it("lists rules from GET /api/visibility", async () => {
    const api = new RestNoteVisibilityApi();
    const { calls } = mockFetchOk([
      {
        kind: "note",
        id: "n1",
        scope: NoteVisibilityScope.RECENT_NOTES,
        hidden_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const entries = await api.list();
    expect(entries).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/visibility$/);
    expect(calls[0].init.method).toBe("GET");
  });

  it("accepts a wrapped list reply", async () => {
    const api = new RestNoteVisibilityApi();
    mockFetchOk({
      entries: [
        {
          kind: "directory",
          id: "d1",
          scope: NoteVisibilityScope.SEARCH,
          hidden_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const entries = await api.list();
    expect(entries[0]?.id).toBe("d1");
  });

  it("posts a note hide with the bitmask and expiry", async () => {
    const api = new RestNoteVisibilityApi();
    const { calls } = mockFetchOk({
      kind: "note",
      id: "n1",
      scope: NoteVisibilityScope.RECENT_NOTES,
      hidden_at: "2026-01-01T00:00:00Z",
    });

    await api.hideNote("n1", NoteVisibilityScope.RECENT_NOTES, { days: 7 });
    const body = JSON.parse(String(calls[0].init.body));
    expect(calls[0].url).toMatch(/\/api\/visibility$/);
    expect(calls[0].init.method).toBe("POST");
    expect(body.note_id).toBe("n1");
    expect(body.scope).toBe(NoteVisibilityScope.RECENT_NOTES);
    expect(Date.parse(body.expires_at)).toBeGreaterThan(Date.now());
  });

  it("posts a directory hide without a note id", async () => {
    const api = new RestNoteVisibilityApi();
    const { calls } = mockFetchOk({
      kind: "directory",
      id: "d1",
      scope: NoteVisibilityScope.FREQUENT_NOTES,
      hidden_at: "2026-01-01T00:00:00Z",
    });

    await api.hideDirectory("d1", NoteVisibilityScope.FREQUENT_NOTES);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.directory_id).toBe("d1");
    expect(body.note_id).toBeUndefined();
    expect(body.scope).toBe(NoteVisibilityScope.FREQUENT_NOTES);
    expect(body.expires_at).toBeUndefined();
  });

  it("deletes a specific rule, or every rule when no target is given", async () => {
    const api = new RestNoteVisibilityApi();
    const { calls } = mockFetchOk({ success: true });

    await api.unhide({ note_id: "n1", scope: NoteVisibilityScope.SEARCH });
    expect(calls[0].init.method).toBe("DELETE");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      note_id: "n1",
      scope: NoteVisibilityScope.SEARCH,
    });

    await api.unhide();
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ all: true });
  });

  it("builds a combined request for either target kind", () => {
    expect(
      buildHideVisibilityRequest(
        { kind: "note", id: "n1" },
        NoteVisibilityScope.SEARCH,
      ),
    ).toEqual({ note_id: "n1", scope: NoteVisibilityScope.SEARCH });
    expect(
      buildHideVisibilityRequest(
        { kind: "directory", id: "d1" },
        NoteVisibilityScope.RECENT_NOTES | NoteVisibilityScope.SEARCH,
      ),
    ).toEqual({
      directory_id: "d1",
      scope: NoteVisibilityScope.RECENT_NOTES | NoteVisibilityScope.SEARCH,
    });
  });

  it("resolves an absolute expiry and rejects an invalid date", () => {
    expect(
      resolveVisibilityExpiry({ until: new Date("2026-02-03T00:00:00Z") }),
    ).toBe("2026-02-03T00:00:00.000Z");
    expect(() => resolveVisibilityExpiry({ until: "not-a-date" })).toThrow();
  });
});