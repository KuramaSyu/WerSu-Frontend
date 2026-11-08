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

/** Long enough for the MUI Slide enter (300ms) and exit (200ms) to finish. */
const SLIDE_SETTLE_MS = 400;

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("HomeGreeting cycle", () => {
  it("starts the stats request after 4s and slides in the note count at 7s", () => {
    render(<HomeGreeting />);

    expect(screen.getByText(/Haru/)).toBeVisible();
    // Every screen is mounted for layout stability; only the active shows.
    expect(screen.getByText("Notes")).not.toBeVisible();
    expect(useStatsMock).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });

    advance(4_000);
    expect(useStatsMock).toHaveBeenLastCalledWith(undefined, {
      enabled: true,
    });

    advance(3_000);
    // Let the greeting slide up and out and the notes slide up in.
    advance(SLIDE_SETTLE_MS);

    expect(screen.getByText("42")).toBeVisible();
    expect(screen.getByText("Notes")).toBeVisible();
    expect(screen.getByText("Characters")).not.toBeVisible();
    expect(screen.getByText("Books")).not.toBeVisible();
    expect(screen.getByText(/Haru/)).not.toBeVisible();
  });

  it("slides through notes, characters, then books and chapters", () => {
    render(<HomeGreeting />);

    advance(7_000);
    advance(SLIDE_SETTLE_MS);
    expect(screen.getByText("Notes")).toBeVisible();
    expect(screen.getByText(/Haru/)).not.toBeVisible();

    // Notes are shown for 4s, then the character count slides up into view.
    advance(4_000 - SLIDE_SETTLE_MS);
    advance(SLIDE_SETTLE_MS);
    expect(screen.getByText(/12\D?345/)).toBeVisible();
    expect(screen.getByText("Characters")).toBeVisible();
    expect(screen.getByText("Notes")).not.toBeVisible();

    // Characters are shown for 3s, then books and chapters slide up together.
    advance(3_000 - SLIDE_SETTLE_MS);
    advance(SLIDE_SETTLE_MS);
    expect(screen.getByText("2")).toBeVisible();
    expect(screen.getByText("Books")).toBeVisible();
    expect(screen.getByText("7")).toBeVisible();
    expect(screen.getByText("Chapters")).toBeVisible();
    expect(screen.getByText("Characters")).not.toBeVisible();
  });

  it("slides back up to the greeting after the stat screens and repeats", () => {
    render(<HomeGreeting />);

    advance(7_000);

    // 4s notes + 3s characters + 3s books/chapters.
    advance(4_000);
    advance(3_000);
    advance(3_000);
    // Let the stats slide out and the greeting slide back in.
    advance(SLIDE_SETTLE_MS);

    expect(screen.getByText(/Haru/)).toBeVisible();
    expect(screen.getByText("Books")).not.toBeVisible();
    expect(useStatsMock).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });

    advance(4_000);
    expect(useStatsMock).toHaveBeenLastCalledWith(undefined, {
      enabled: true,
    });
  });
});
