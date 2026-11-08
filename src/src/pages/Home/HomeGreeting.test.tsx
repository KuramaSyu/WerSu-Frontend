// @vitest-environment jsdom

import "../../test/setup";

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useStatsMock } = vi.hoisted(() => ({ useStatsMock: vi.fn() }));

vi.mock("../../api/queries/useStats", () => ({
  useStats: useStatsMock,
}));

// Keep the timer assertions focused on the HomeGreeting cycle instead of
// waiting for framer-motion's exit/enter animations.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: unknown }) => children,
  motion: {
    div: ({ children }: { children: unknown }) => children,
  },
  useReducedMotion: () => false,
}));

import { HomeGreeting } from "./HomeGreeting";
import { useUserStore } from "../../zustand/userStore";
import type { CalculatedStatsReply } from "../../api/models/stats";

const statsReply: CalculatedStatsReply = {
  user_id: "user-1",
  total_chars: 12345,
  total_notes: 42,
  total_chapters: 7,
  total_books: 2,
  calculated_at: "2026-04-08T00:00:00Z",
};

beforeEach(() => {
  vi.useFakeTimers();
  useStatsMock.mockReset().mockImplementation((_id, options) => {
    const enabled = options?.enabled ?? true;
    return {
      data: enabled ? statsReply : undefined,
      isPending: !enabled,
      isError: false,
      isSuccess: enabled,
    };
  });
  useUserStore.setState({
    user: { username: "Haru" } as never,
    loggedOut: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HomeGreeting cycle", () => {
  it("starts the stats request after 7s and shows stats after 10s", () => {
    render(<HomeGreeting />);

    expect(screen.getByText(/Haru/)).toBeInTheDocument();
    expect(useStatsMock).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });

    act(() => {
      vi.advanceTimersByTime(7_000);
    });
    expect(useStatsMock).toHaveBeenLastCalledWith(undefined, {
      enabled: true,
    });

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByLabelText("Your stats")).toBeInTheDocument();
    expect(screen.getByText(/Library contains/)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("returns to the greeting after 20s of stats and repeats", () => {
    render(<HomeGreeting />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByLabelText("Your stats")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByText(/Haru/)).toBeInTheDocument();
    expect(useStatsMock).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });

    act(() => {
      vi.advanceTimersByTime(7_000);
    });
    expect(useStatsMock).toHaveBeenLastCalledWith(undefined, {
      enabled: true,
    });
  });
});
