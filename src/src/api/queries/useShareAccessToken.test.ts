// Tier 1 tests for `useShareAccessToken`.
//
// Goal: pin the retry cadence so a future refactor doesn't reintroduce
// the tight loop that hit production when the backend started handing
// out already-expired JWTs (revoked / `online_until` in the past).
//
//   1. POST succeeds with a JWT whose `exp` is in the future ->
//      next refresh fires at `exp - JWT_REFRESH_BUFFER`.
//   2. POST succeeds with a JWT whose `exp` is already in the past ->
//      next refresh falls back to `FALLBACK_REFRESH_MS`, NOT 0ms.
//      Without the fallback, `setTimeout(refresh, 0)` fires on every
//      tick and the backend is spammed.
//   3. POST fails -> next refresh uses `FALLBACK_REFRESH_MS`.
//   4. Unmount / empty `shareId` -> JWT cleared from the store.
//
// We mock the public sharing API only; the zustand auth store and
// React lifecycle are real.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAuthStore } from "../../zustand/useAuthStore";
import { publicSharingApi } from "../SharingApi";
import { useShareAccessToken } from "./useShareAccessToken";

/**
 * Build a fake JWT whose `exp` claim is the given epoch-seconds value.
 * `atob` / `btoa` only handle latin1; we build the JSON body without
 * non-ASCII characters so the round-trip is lossless.
 */
const makeJwt = (expEpochSeconds: number): string => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ exp: expEpochSeconds }));
  return `${header}.${payload}.fake-signature`;
};

/**
 * Fallback cadence (ms) the hook uses when the JWT is already expired
 * or the POST fails. Mirrored from `FALLBACK_REFRESH_MS` so the test
 * doesn't need to import a private constant.
 */
const FALLBACK_REFRESH_MS = 30_000;

const mockedFetch = vi.spyOn(publicSharingApi, "fetchPublicAccessToken");

beforeEach(() => {
  mockedFetch.mockReset();
  // Default to a token that's valid for an hour - tests that want a
  // different shape override this mock.
  mockedFetch.mockResolvedValue({
    token: makeJwt(Math.floor(Date.now() / 1000) + 3600),
  });
  useAuthStore.setState({
    accessToken: null,
    shareAccessToken: null,
    listeners: new Set(),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useShareAccessToken - expired-token fallback", () => {
  it("does not tight-loop when the backend returns an already-expired JWT", async () => {
    // Regression: with `exp` already in the past, the previous
    // implementation clamped `scheduleRefreshMs` to 0 and called
    // `setTimeout(refresh, 0)`, which fires on every tick and spams
    // the backend. The fix falls back to FALLBACK_REFRESH_MS.
    const tenSecondsAgo = Math.floor(Date.now() / 1000) - 10;
    mockedFetch.mockResolvedValue({ token: makeJwt(tenSecondsAgo) });

    vi.useFakeTimers();
    renderHook(() => useShareAccessToken({ shareId: "share-expired" }));

    // Drain the microtask queue so the initial POST + token storage
    // completes before we start poking at the timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    // Advance by less than FALLBACK_REFRESH_MS. With the bug, a 1ms
    // tick would already have re-fired the POST.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    // Cross the FALLBACK_REFRESH_MS boundary; the POST should fire
    // exactly once more.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FALLBACK_REFRESH_MS);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("uses the exp-claim cadence when the JWT has a future exp", async () => {
    // Pin the happy path so a future refactor that "always uses the
    // fallback" doesn't slip past the test for the expired case.
    const expInOneMinute = Math.floor(Date.now() / 1000) + 60;
    mockedFetch.mockResolvedValue({ token: makeJwt(expInOneMinute) });

    vi.useFakeTimers();
    renderHook(() => useShareAccessToken({ shareId: "share-fresh" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    // `exp - JWT_REFRESH_BUFFER` is effectively now (60s - 60s = 0),
    // which falls into the `waitMs <= 0` branch and uses
    // FALLBACK_REFRESH_MS. Asserting the call count at this boundary
    // pins both branches in one shot.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FALLBACK_REFRESH_MS);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
});

describe("useShareAccessToken - error fallback", () => {
  it("uses FALLBACK_REFRESH_MS when the POST throws", async () => {
    // Network blips should NOT tight-loop. Same fallback cadence as
    // the already-expired case.
    mockedFetch.mockRejectedValue(new Error("network down"));

    vi.useFakeTimers();
    renderHook(() => useShareAccessToken({ shareId: "share-broken" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FALLBACK_REFRESH_MS);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
});

describe("useShareAccessToken - lifecycle", () => {
  it("clears the share token from the store when shareId becomes null", async () => {
    // Pin the cleanup path so navigating between two share URLs (or
    // away from a share page) doesn't leave a stale token in the
    // store.
    vi.useFakeTimers();
    const { rerender } = renderHook(
      ({ shareId }: { shareId: string | null }) =>
        useShareAccessToken({ shareId }),
      { initialProps: { shareId: "share-x" as string | null } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(useAuthStore.getState().shareAccessToken).not.toBeNull();

    rerender({ shareId: null });
    expect(useAuthStore.getState().shareAccessToken).toBeNull();
  });
});
