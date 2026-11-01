// Regression tests for the explicit-logout latch in `useUser`.
//
// The bug: logging out cleared the React Query cache while `useUser`
// was still mounted, so the observer immediately refetched, the query
// succeeded against a still-valid cookie / fake backend, and the top
// bar avatar (plus all auth-gated content) came right back.

// @vitest-environment jsdom

import "../../test/setup";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { fetchUser } = vi.hoisted(() => ({ fetchUser: vi.fn() }));

vi.mock("../UserApi", () => ({
  getUserApi: () => ({ fetchUser }),
}));

vi.mock("../../components/DiscordLogin", () => ({
  WersuUserImpl: class WersuUserImplStub {
    id: string;
    constructor(data: { id: string }) {
      this.id = data.id;
    }
  },
}));

import { useUser } from "./useUser";
import { useUserStore } from "../../zustand/userStore";

const buildWrapper =
  (qc: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

const makeClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useUser logout latch", () => {
  beforeEach(() => {
    fetchUser.mockReset();
    useUserStore.setState({ user: null, loggedOut: false });
  });

  it("fetches the user on a cold start", async () => {
    fetchUser.mockResolvedValue({ id: "u1", username: "Haru" });
    const qc = makeClient();

    const { result } = renderHook(() => useUser(), {
      wrapper: buildWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchUser).toHaveBeenCalledTimes(1);
  });

  it("stays disabled after logout even when the cache is cleared", async () => {
    fetchUser.mockResolvedValue({ id: "u1", username: "Haru" });
    const qc = makeClient();

    const { result } = renderHook(() => useUser(), {
      wrapper: buildWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // What `handleLogout` does: latch, then drop the cache while the
    // observer is still mounted.
    useUserStore.getState().setLoggedOut();
    qc.clear();

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.data).toBeUndefined();
    expect(fetchUser).toHaveBeenCalledTimes(1);
  });

  it("refetches once a fresh login clears the latch", async () => {
    fetchUser.mockResolvedValue({ id: "u1", username: "Haru" });
    const qc = makeClient();

    const { result } = renderHook(() => useUser(), {
      wrapper: buildWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    useUserStore.getState().setLoggedOut();
    qc.clear();

    useUserStore.getState().setUser({ id: "u2" } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchUser).toHaveBeenCalledTimes(2);
  });
});
