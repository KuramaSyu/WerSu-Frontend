// Tier 1 tests for the extracted directory delete mutation: API call,
// cache removal, invalidation and the boolean result.

// @vitest-environment jsdom

import "../../test/setup";

import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  remove: vi.fn(),
  removeDirectory: vi.fn(),
}));

vi.mock("../DirectoryApi", () => ({
  DirectoryApi: class {
    delete = mocks.remove;
  },
}));

vi.mock("./directoryQueries", () => ({
  removeDirectory: mocks.removeDirectory,
}));

vi.mock("./useUser", () => ({
  useUserKey: () => "user-1",
}));

import { useDirectoryDelete } from "./useDirectoryMutations";

const queryClient = new QueryClient();

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDirectoryDelete", () => {
  it("deletes, drops the cache entry and invalidates", async () => {
    mocks.remove.mockResolvedValue({ id: "dir-1" });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDirectoryDelete(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current("dir-1");
    });

    expect(ok).toBe(true);
    expect(mocks.remove).toHaveBeenCalledWith("dir-1");
    expect(mocks.removeDirectory).toHaveBeenCalledWith(queryClient, "dir-1");
    expect(invalidate).toHaveBeenCalled();
  });

  it("reports false and leaves the cache alone when the API declines", async () => {
    mocks.remove.mockResolvedValue(undefined);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDirectoryDelete(), { wrapper });
    let ok = true;
    await act(async () => {
      ok = await result.current("dir-2");
    });

    expect(ok).toBe(false);
    expect(mocks.removeDirectory).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
