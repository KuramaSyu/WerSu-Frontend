// Fake-mode coverage for `/api/preferences`, the row that backs the
// per-note spell-check setting.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
import { getFakeDb, resetFakeDb } from "./types";

const server = setupServer(...handlers);
const BASE = "http://localhost/api/preferences";
const KEY = "spellcheck@note:note-1";

const target = { scope: "user", target_id: "user-1", key: KEY };

async function patch(body: Record<string, unknown>) {
  return await fetch(BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, ...body }),
  });
}

describe("fake /api/preferences", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  afterAll(() => {
    server.close();
  });
  beforeEach(() => {
    resetFakeDb();
  });
  afterEach(() => {
    server.resetHandlers(...handlers);
  });

  it("echoes {} for a row that was never written", async () => {
    const reply = await fetch(
      `${BASE}?scope=user&target_id=user-1&key=${encodeURIComponent(KEY)}`,
    );
    expect(reply.status).toBe(200);
    await expect(reply.json()).resolves.toMatchObject({
      scope: "user",
      target_id: "user-1",
      key: KEY,
      preferences_json: "{}",
    });
  });

  it("shallow-merges PATCH bodies like the backend", async () => {
    await patch({
      preferences_json: JSON.stringify({
        version: 1,
        enabled: false,
        language: "en",
      }),
    });
    const reply = await patch({
      preferences_json: JSON.stringify({ enabled: true }),
    });

    await expect(reply.json()).resolves.toMatchObject({
      preferences_json: JSON.stringify({
        version: 1,
        enabled: true,
        language: "en",
      }),
    });
    expect(getFakeDb().preferences).toHaveLength(1);
  });

  it("replaces the blob wholesale on POST", async () => {
    await patch({
      preferences_json: JSON.stringify({ enabled: true, language: "de" }),
    });
    const reply = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...target,
        preferences_json: JSON.stringify({ enabled: false, language: "en" }),
      }),
    });

    await expect(reply.json()).resolves.toMatchObject({
      preferences_json: JSON.stringify({ enabled: false, language: "en" }),
    });
  });

  it("deletes and reports success idempotently", async () => {
    await patch({ preferences_json: JSON.stringify({ enabled: true }) });

    const first = await fetch(BASE, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
    });
    await expect(first.json()).resolves.toEqual({ success: true });

    const second = await fetch(BASE, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
    });
    await expect(second.json()).resolves.toEqual({ success: false });
  });

  it("rejects invalid JSON on PATCH", async () => {
    const reply = await patch({ preferences_json: "not json" });
    expect(reply.status).toBe(400);
  });

  it("enforces the 50 keyed-row limit", async () => {
    // Seed the budget directly instead of 50 HTTP round-trips.
    getFakeDb().preferences = Array.from({ length: 50 }, (_, index) => ({
      scope: "user" as const,
      target_id: "user-1",
      key: `spellcheck@note:note-${String(index)}`,
      preferences_json: JSON.stringify({ enabled: true }),
    }));
    const reply = await patch({
      key: "spellcheck@note:note-overflow",
      preferences_json: JSON.stringify({ enabled: true }),
    });
    expect(reply.status).toBe(409);
  });
});