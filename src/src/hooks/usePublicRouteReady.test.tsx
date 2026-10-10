// Tier 1 tests for usePublicRouteReady: request gate, tripwire
// timeout, and the route predicate.

// @vitest-environment jsdom

import "../test/setup";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

import { usePublicRouteReady } from "./usePublicRouteReady";
import { useAuthStore } from "../zustand/useAuthStore";

const wrap =
  (pathname: string) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
  );

beforeEach(() => {
  useAuthStore.setState({ shareAccessToken: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePublicRouteReady - private route bypass", () => {
  it("passes through immediately with no timer", () => {
    useAuthStore.setState({ shareAccessToken: null });
    const { result } = renderHook(() => usePublicRouteReady(), {
      wrapper: wrap("/n/note-x"),
    });
    expect(result.current).toEqual({
      isPublic: false,
      ready: true,
      timedOut: false,
    });
  });

  it("isPublic is false on private routes", () => {
    const { result } = renderHook(() => usePublicRouteReady(), {
      wrapper: wrap("/settings/account"),
    });
    expect(result.current.isPublic).toBe(false);
  });
});

describe("usePublicRouteReady - public route JWT already present", () => {
  it("reports ready immediately and never arms the timeout", () => {
    useAuthStore.setState({ shareAccessToken: "share-jwt-fresh" });
    vi.useFakeTimers();
    const { result } = renderHook(() => usePublicRouteReady(), {
      wrapper: wrap("/public/n/share-1"),
    });
    expect(result.current).toEqual({
      isPublic: true,
      ready: true,
      timedOut: false,
    });
    vi.advanceTimersByTime(60_000);
    expect(result.current.timedOut).toBe(false);
  });
});

describe("usePublicRouteReady - public route JWT never arrives", () => {
  it("flips timedOut to true after timeoutMs elapses", () => {
    useAuthStore.setState({ shareAccessToken: null });
    vi.useFakeTimers();
    const { result } = renderHook(
      () => usePublicRouteReady({ timeoutMs: 5_000 }),
      { wrapper: wrap("/public/n/share-1") },
    );
    expect(result.current).toEqual({
      isPublic: true,
      ready: false,
      timedOut: false,
    });
    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(result.current.timedOut).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.timedOut).toBe(true);
    expect(result.current.ready).toBe(false);
  });
});

describe("usePublicRouteReady - public route JWT arrives mid-flight", () => {
  it("disarms the tripwire so timedOut never flips", () => {
    useAuthStore.setState({ shareAccessToken: null });
    vi.useFakeTimers();
    const { result } = renderHook(
      () => usePublicRouteReady({ timeoutMs: 5_000 }),
      { wrapper: wrap("/public/n/share-1") },
    );
    expect(result.current.ready).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1_000);
      useAuthStore.setState({ shareAccessToken: "share-jwt-late" });
    });
    expect(result.current.ready).toBe(true);
    expect(result.current.timedOut).toBe(false);
    // Past the original budget - the cleared setTimeout never fires.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.timedOut).toBe(false);
  });
});

describe("usePublicRouteReady - escape hatch", () => {
  it("timeoutMs: 0 disables the tripwire (request gates)", () => {
    useAuthStore.setState({ shareAccessToken: null });
    vi.useFakeTimers();
    const { result } = renderHook(() => usePublicRouteReady({ timeoutMs: 0 }), {
      wrapper: wrap("/public/n/share-1"),
    });
    expect(result.current).toEqual({
      isPublic: true,
      ready: false,
      timedOut: false,
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.timedOut).toBe(false);
    expect(result.current.ready).toBe(false);
  });
});

describe("usePublicRouteReady - isPublic reflects pathname", () => {
  it("isPublic is true on /public/* paths", () => {
    const { result } = renderHook(() => usePublicRouteReady(), {
      wrapper: wrap("/public/n/share-1"),
    });
    expect(result.current.isPublic).toBe(true);
  });

  it("isPublic is true for future public siblings (e.g. /public/d/...)", () => {
    const { result } = renderHook(() => usePublicRouteReady(), {
      wrapper: wrap("/public/d/dir-1"),
    });
    expect(result.current.isPublic).toBe(true);
  });
});
