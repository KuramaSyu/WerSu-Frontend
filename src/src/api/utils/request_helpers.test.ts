import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "../SharingApi";
import {
  errorMessageFromPayload,
  extractAttachmentKeyFromUrl,
  extractShareIdFromUrl,
  readErrorPayload,
  requestJson,
  toQueryString,
} from "./request_helpers";

describe("toQueryString", () => {
  it("returns an empty string for an empty object", () => {
    expect(toQueryString({})).toBe("");
  });

  it("skips nullish values", () => {
    expect(
      toQueryString({
        a: "1",
        b: null,
        c: undefined,
        d: false,
      }),
    ).toBe("?a=1&d=false");
  });

  it("serializes numbers, booleans, and arrays", () => {
    expect(
      toQueryString({
        name: "John",
        age: 30,
        active: true,
        tags: ["javascript", "typescript"],
      }),
    ).toBe("?name=John&age=30&active=true&tags=javascript&tags=typescript");
  });

  it("serializes empty arrays as omitted entries", () => {
    expect(toQueryString({ tags: [] })).toBe("");
  });
});

describe("readErrorPayload", () => {
  it("parses JSON error payloads", async () => {
    const response = new Response(JSON.stringify({ message: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

    await expect(readErrorPayload(response)).resolves.toEqual({
      message: "Bad request",
    });
  });

  it("returns a fallback object when JSON parsing fails", async () => {
    const response = new Response("not valid json", {
      status: 500,
      headers: { "content-type": "application/json" },
    });

    await expect(readErrorPayload(response)).resolves.toEqual({
      message: "Failed to parse JSON error body",
    });
  });

  it("returns plain text as a message object for non-json responses", async () => {
    const response = new Response("Something went wrong", {
      status: 500,
      statusText: "Internal Server Error",
      headers: { "content-type": "text/plain" },
    });

    await expect(readErrorPayload(response)).resolves.toEqual({
      message: "Something went wrong",
    });
  });

  it("falls back to statusText when the body is empty", async () => {
    const response = new Response("", {
      status: 404,
      statusText: "Not Found",
      headers: { "content-type": "text/plain" },
    });

    await expect(readErrorPayload(response)).resolves.toEqual({
      message: "Not Found",
    });
  });
});

describe("errorMessageFromPayload", () => {
  it("prefers payload.message when present", () => {
    expect(errorMessageFromPayload({ message: "Boom" }, "fallback")).toBe(
      "Boom",
    );
  });

  it("falls back to the first string value in the payload", () => {
    expect(
      errorMessageFromPayload(
        { code: 123, detail: "First string here", other: true },
        "fallback",
      ),
    ).toBe("First string here");
  });

  it("returns the fallback when no message can be extracted", () => {
    expect(errorMessageFromPayload({ code: 123, ok: false }, "fallback")).toBe(
      "fallback",
    );
  });
});

describe("requestJson", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the request with credentials and Accept: application/json", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await requestJson<{ ok: boolean }>("/api/test", {
      method: "POST",
      headers: { "X-Test": "1" },
      body: JSON.stringify({ hello: "world" }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify({ hello: "world" }),
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-Test": "1",
        }),
      }),
    );
  });

  it("returns parsed JSON for JSON responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 123, name: "Alice" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      requestJson<{ id: number; name: string }>("/api/user", {}),
    ).resolves.toEqual({
      id: 123,
      name: "Alice",
    });
  });

  it("returns text for non-JSON responses", async () => {
    fetchMock.mockResolvedValue(
      new Response("plain text body", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    await expect(requestJson<string>("/api/text", {})).resolves.toBe(
      "plain text body",
    );
  });

  it("returns undefined for 204 No Content", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    await expect(
      requestJson<void>("/api/no-content", {}),
    ).resolves.toBeUndefined();
  });

  it("throws ApiError with a message derived from the error payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Validation failed" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const promise = requestJson("/api/error", {});

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      message: "Validation failed",
    });
  });

  it("falls back to a generic message when the payload has no message", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Nope" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    const promise = requestJson("/api/error", {});

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      message: "Nope",
    });
  });
});

describe("extractShareIdFromUrl", () => {
  it("returns trimmed bare IDs unchanged", () => {
    expect(extractShareIdFromUrl("abc123")).toBe("abc123");
    expect(extractShareIdFromUrl("  abc123  ")).toBe("abc123");
  });

  it("returns empty string for empty or whitespace input", () => {
    expect(extractShareIdFromUrl("")).toBe("");
    expect(extractShareIdFromUrl("   ")).toBe("");
  });

  it("extracts ID from a /s/<id> URL", () => {
    expect(
      extractShareIdFromUrl(
        "https://app.example.com/s/0195f8f4-1167-7f89-b5ec-b40a8f08f4cb",
      ),
    ).toBe("0195f8f4-1167-7f89-b5ec-b40a8f08f4cb");
  });

  it("extracts ID from a URL with extra path segments", () => {
    expect(
      extractShareIdFromUrl(
        "https://app.example.com/shared/notes/0195f8f4-1167-7f89-b5ec-b40a8f08f4cb",
      ),
    ).toBe("0195f8f4-1167-7f89-b5ec-b40a8f08f4cb");
  });

  it("strips trailing query string from a /s/<id> URL", () => {
    expect(
      extractShareIdFromUrl(
        "https://app.example.com/s/0195f8f4-1167-7f89-b5ec-b40a8f08f4cb?foo=bar",
      ),
    ).toBe("0195f8f4-1167-7f89-b5ec-b40a8f08f4cb");
  });

  it("prefers ?share_id=... over the path", () => {
    expect(
      extractShareIdFromUrl(
        "https://app.example.com/s/from-path?share_id=from-query",
      ),
    ).toBe("from-query");
  });

  it("accepts ?share=... as an alias for ?share_id=...", () => {
    expect(extractShareIdFromUrl("https://app.example.com/?share=abc123")).toBe(
      "abc123",
    );
  });

  it("returns empty string for a URL with no path segments or query ID", () => {
    expect(extractShareIdFromUrl("https://app.example.com/")).toBe("");
  });
});

describe("extractAttachmentKeyFromUrl", () => {
  it("extracts the key query parameter from an image URL", () => {
    expect(
      extractAttachmentKeyFromUrl(
        "https://api.example.com/api/attachments/image?key=0195f8f4-1167-7f89-b5ec-b40a8f08f4cb&width=720&format=webp",
      ),
    ).toBe("0195f8f4-1167-7f89-b5ec-b40a8f08f4cb");
  });

  it("extracts the key from a raw /api/attachments/?key=... URL", () => {
    expect(
      extractAttachmentKeyFromUrl(
        "https://api.example.com/api/attachments/?key=abc%2F123",
      ),
    ).toBe("abc/123");
  });

  it("falls back to the last path segment when no key= query param is present", () => {
    // This is the URL shape that linkAttachment() writes into note
    // content: /attachments/<encoded uuid>, optionally followed by
    // decoration params (width/format/jwt) on the query string.
    expect(
      extractAttachmentKeyFromUrl(
        "https://api.example.com/attachments/0195f8f4-1167-7f89-b5ec-b40a8f08f4cb",
      ),
    ).toBe("0195f8f4-1167-7f89-b5ec-b40a8f08f4cb");
  });

  it("handles /attachments/image/<uuid> path-segment image URLs", () => {
    // Image variant where the key is a path segment under
    // /attachments/image/. Decoration params ride along on the query
    // string and must not confuse the extractor.
    expect(
      extractAttachmentKeyFromUrl(
        "https://api.example.com/attachments/image/0195f8f4-1167-7f89-b5ec-b40a8f08f4cb?width=720&format=webp&jwt=tok",
      ),
    ).toBe("0195f8f4-1167-7f89-b5ec-b40a8f08f4cb");
  });

  it("decodes URL-encoded path-segment keys", () => {
    expect(
      extractAttachmentKeyFromUrl(
        "https://api.example.com/api/attachments/abc%2F123",
      ),
    ).toBe("abc/123");
  });

  it("ignores decoration query params when falling back to the path", () => {
    expect(
      extractAttachmentKeyFromUrl(
        "https://api.example.com/attachments/0195f8f4-1167-7f89-b5ec-b40a8f08f4cb?width=720&format=webp&jwt=abc",
      ),
    ).toBe("0195f8f4-1167-7f89-b5ec-b40a8f08f4cb");
  });

  it("prefers the key= query param over the path when both are present", () => {
    // Defensive: in practice only one shape is emitted, but if some
    // future URL builder produces both, the query param wins so we
    // stay consistent with the documented contract.
    expect(
      extractAttachmentKeyFromUrl(
        "https://api.example.com/attachments/path-key?key=query-key",
      ),
    ).toBe("query-key");
  });

  it("returns empty string when no key param or path segment is present", () => {
    expect(extractAttachmentKeyFromUrl("https://api.example.com/")).toBe("");
  });

  it("returns empty string for non-URL input", () => {
    expect(extractAttachmentKeyFromUrl("not a url")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(extractAttachmentKeyFromUrl("")).toBe("");
  });
});
