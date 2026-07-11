import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("prepareBackendLink", () => {
  // The util reads `BACKEND_BASE` from `../statics`, which in turn reads
  // `import.meta.env.VITE_BACKEND_URL`. Vitest doesn't populate that,
  // so we pin it explicitly for each test.
  const ORIGINAL_ENV = import.meta.env.VITE_BACKEND_URL;
  const setBackendBase = (value: string | undefined): void => {
    if (value === undefined) {
      delete (import.meta.env as Record<string, unknown>).VITE_BACKEND_URL;
    } else {
      (import.meta.env as Record<string, unknown>).VITE_BACKEND_URL = value;
    }
    vi.resetModules();
  };

  beforeEach(() => {
    setBackendBase("https://api.example.com");
  });
  afterEach(() => {
    setBackendBase(ORIGINAL_ENV);
  });

  async function loadUtil() {
    return (await import("./prepareBackendLink")).prepareBackendLink;
  }

  it("returns empty input untouched", async () => {
    const prepareBackendLink = await loadUtil();
    expect(prepareBackendLink("")).toBe("");
    expect(prepareBackendLink(null)).toBe("");
    expect(prepareBackendLink(undefined)).toBe("");
  });

  it("leaves absolute http(s) URLs alone", async () => {
    const prepareBackendLink = await loadUtil();
    expect(prepareBackendLink("https://cdn.example.com/x.png")).toBe(
      "https://cdn.example.com/x.png",
    );
    expect(prepareBackendLink("http://localhost:8080/img.png")).toBe(
      "http://localhost:8080/img.png",
    );
  });

  it("leaves data: and blob: URLs alone", async () => {
    const prepareBackendLink = await loadUtil();
    expect(prepareBackendLink("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(prepareBackendLink("blob:https://x/1234-5678")).toBe(
      "blob:https://x/1234-5678",
    );
  });

  it("leaves protocol-relative URLs alone", async () => {
    const prepareBackendLink = await loadUtil();
    expect(prepareBackendLink("//cdn.example.com/x.png")).toBe(
      "//cdn.example.com/x.png",
    );
  });

  it("prefixes backend-relative paths with BACKEND_BASE", async () => {
    const prepareBackendLink = await loadUtil();
    expect(prepareBackendLink("/api/attachments/abc")).toBe(
      "https://api.example.com/api/attachments/abc",
    );
  });

  it("prefixes paths without a leading slash as a relative path", async () => {
    const prepareBackendLink = await loadUtil();
    expect(prepareBackendLink("api/attachments/abc")).toBe(
      "https://api.example.com/api/attachments/abc",
    );
  });

  it("works when BACKEND_BASE is empty (default fallback)", async () => {
    setBackendBase(undefined);
    const prepareBackendLink = await loadUtil();
    expect(prepareBackendLink("/api/attachments/abc")).toBe(
      "/api/attachments/abc",
    );
    expect(prepareBackendLink("api/attachments/abc")).toBe(
      "/api/attachments/abc",
    );
  });
});
