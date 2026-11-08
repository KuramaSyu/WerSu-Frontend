// Tier 1 tests for the stats query hooks. The important contract is that the
// Home greeting can keep the query mounted but disabled until its 7-second
// lazy-load timer fires.

// @vitest-environment jsdom

import "../../test/setup";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { statsApi } = vi.hoisted(() => ({
  statsApi: {
    getStats: vi.fn(),
    getStatsForUser: vi.fn(),
  },
}));

vi.mock("../StatsApi", () => ({
  getStatsApi: () => statsApi,
}));

vi.mock("./useUser", () => ({
  useIsAuthenticated: () => true,
  useUserKey: () => "user-1",
}));

import { useStats, useStatsForUser } from "./useStats";
import type { CalculatedStatsReply } from "../models/stats";

const statsReply: CalculatedStatsReply = {
  user_id: "user-1",
  total_chars: 12345,
  total_notes: 42,
  total_chapters: 7,
  total_books: 2,
  calculated_at: "2026-04-08T00:00:00Z",
};

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  statsApi.getStats.mockReset().mockResolvedValue(statsReply);
  statsApi.getStatsForUser.mockReset().mockResolvedValue(statsReply);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe("useStats", () => {
  it("stays idle while disabled", () => {
    const { result } = renderHook(
      () => useStats(undefined, { enabled: false }),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(statsApi.getStats).not.toHaveBeenCalled();
  });

  it("fetches the caller's own stats once enabled", async () => {
    const { result } = renderHook(
      () => useStats(undefined, { enabled: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(statsReply);
    expect(statsApi.getStats).toHaveBeenCalledTimes(1);
    expect(statsApi.getStatsForUser).not.toHaveBeenCalled();
  });

  it("does not refetch immediately while the row is fresh", async () => {
    const { result, rerender } = renderHook(
      () => useStats(undefined, { enabled: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender();
    expect(statsApi.getStats).toHaveBeenCalledTimes(1);
  });
});

describe("useStatsForUser", () => {
  it("fetches the target user's stats", async () => {
    const { result } = renderHook(
      () => useStatsForUser("target-user", { enabled: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(statsReply);
    expect(statsApi.getStatsForUser).toHaveBeenCalledWith("target-user");
    expect(statsApi.getStats).not.toHaveBeenCalled();
  });
});
