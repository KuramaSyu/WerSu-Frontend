// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKEND_BASE } from "../statics";
import { fetchImageBlob } from "./imageBlur";

const fetchMock = vi.fn();

const okResponse = (): Response =>
  ({
    ok: true,
    status: 200,
    blob: async () => new Blob(["image"], { type: "image/webp" }),
  }) as unknown as Response;

describe("fetchImageBlob credentials", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the session cookie to the backend image endpoint", async () => {
    const url = `${BACKEND_BASE}/api/attachments/image?width=720&format=webp&key=attachments%252Fabc`;

    await fetchImageBlob(url);

    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sends credentials for backend-relative URLs", async () => {
    await fetchImageBlob("/api/attachments/image?key=abc");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/attachments/image?key=abc",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("does not send credentials to third-party image hosts", async () => {
    await fetchImageBlob("https://example.com/photo.webp");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/photo.webp",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});
