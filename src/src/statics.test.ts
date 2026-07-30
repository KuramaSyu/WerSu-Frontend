import { beforeEach, describe, expect, it, vi } from "vitest";

type RuntimeEnv = {
  BACKEND_BASE?: string;
  HOCUSPOCUS_WS_URL?: string;
};

type WindowWithEnv = Window & { __ENV__?: RuntimeEnv };

// Vitest's default env is `node`, so `window` is undefined unless we stub it; `statics.tsx`'s `typeof window !== "undefined"` guard checks `globalThis.window`.
const stubWindow = (): WindowWithEnv => {
  if (typeof (globalThis as { window?: unknown }).window === "undefined") {
    (globalThis as { window: unknown }).window = {};
  }
  return globalThis.window as WindowWithEnv;
};

const setRuntimeEnv = (env: RuntimeEnv | undefined): void => {
  const w = stubWindow();
  if (env === undefined) delete w.__ENV__;
  else w.__ENV__ = env;
  vi.resetModules();
};

const setBuildEnv = (
  vars: Partial<{
    VITE_BACKEND_URL: string;
    VITE_HOCUSPOCUS_WS_URL: string;
  }>,
): void => {
  const env = import.meta.env as Record<string, unknown>;
  for (const key of ["VITE_BACKEND_URL", "VITE_HOCUSPOCUS_WS_URL"] as const) {
    const val = vars[key];
    if (val === undefined) delete env[key];
    else env[key] = val;
  }
  vi.resetModules();
};

describe("statics", () => {
  beforeEach(() => {
    setRuntimeEnv(undefined);
  });

  it("prefers runtime BACKEND_BASE over build-time VITE_BACKEND_URL", async () => {
    setBuildEnv({ VITE_BACKEND_URL: "https://build.example.com" });
    setRuntimeEnv({ BACKEND_BASE: "https://runtime.example.com" });
    const { BACKEND_BASE } = await import("./statics");
    expect(BACKEND_BASE).toBe("https://runtime.example.com");
  });

  it("falls back to VITE_BACKEND_URL when runtime env has no key", async () => {
    setBuildEnv({ VITE_BACKEND_URL: "https://build.example.com" });
    setRuntimeEnv({});
    const { BACKEND_BASE } = await import("./statics");
    expect(BACKEND_BASE).toBe("https://build.example.com");
  });

  it("is empty when neither runtime nor build-time is set", async () => {
    setBuildEnv({});
    setRuntimeEnv(undefined);
    const { BACKEND_BASE } = await import("./statics");
    expect(BACKEND_BASE).toBe("");
  });

  it("lets an empty-string runtime value override the build-time one", async () => {
    setBuildEnv({ VITE_BACKEND_URL: "https://build.example.com" });
    setRuntimeEnv({ BACKEND_BASE: "" });
    const { BACKEND_BASE } = await import("./statics");
    expect(BACKEND_BASE).toBe("");
  });

  it("prefers runtime HOCUSPOCUS_WS_URL over build-time", async () => {
    setBuildEnv({ VITE_HOCUSPOCUS_WS_URL: "wss://build.example.com" });
    setRuntimeEnv({ HOCUSPOCUS_WS_URL: "wss://runtime.example.com" });
    const { HOCUSPOCUS_WS_URL } = await import("./statics");
    expect(HOCUSPOCUS_WS_URL).toBe("wss://runtime.example.com");
  });

  it("falls back to VITE_HOCUSPOCUS_WS_URL when runtime env has no key", async () => {
    setBuildEnv({ VITE_HOCUSPOCUS_WS_URL: "wss://build.example.com" });
    setRuntimeEnv({});
    const { HOCUSPOCUS_WS_URL } = await import("./statics");
    expect(HOCUSPOCUS_WS_URL).toBe("wss://build.example.com");
  });
});
