// @vitest-environment jsdom

import "../test/setup";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutPulse, SHORTCUT_PULSE_DURATION_MS } from "./ShortcutPulse";
import { useShortcutPulseStore } from "../zustand/useShortcutPulseStore";

beforeEach(() => {
  vi.useFakeTimers();
  useShortcutPulseStore.setState({ pulse: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ShortcutPulse", () => {
  it("renders nothing without a pulse", () => {
    const { container } = render(<ShortcutPulse />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the pulse and clears it once the sweep ends", () => {
    render(<ShortcutPulse />);

    act(() => {
      useShortcutPulseStore
        .getState()
        .triggerPulse({ key: "i", keyLabel: "I", label: "Enter insert mode" });
    });

    expect(screen.getByTestId("shortcut-pulse")).toBeInTheDocument();
    expect(screen.getByText("Enter insert mode")).toBeInTheDocument();

    // The sweep's own animationend is the primary clear path, so the
    // pulse cannot be cut short by a timer that outruns the animation.
    act(() => {
      fireEvent(
        screen.getByTestId("shortcut-pulse-sweep"),
        new Event("animationend", { bubbles: true }),
      );
    });

    expect(screen.queryByTestId("shortcut-pulse")).not.toBeInTheDocument();
  });

  it("clears via the fallback when the sweep never ends", () => {
    render(<ShortcutPulse />);

    act(() => {
      useShortcutPulseStore
        .getState()
        .triggerPulse({ key: "i", keyLabel: "I", label: "Enter insert mode" });
    });

    // Still visible well past the animation duration.
    act(() => {
      vi.advanceTimersByTime(SHORTCUT_PULSE_DURATION_MS);
    });
    expect(screen.getByTestId("shortcut-pulse")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SHORTCUT_PULSE_DURATION_MS * 2 + 250);
    });
    expect(screen.queryByTestId("shortcut-pulse")).not.toBeInTheDocument();
  });

  it("restarts the sweep when triggered again", () => {
    render(<ShortcutPulse />);

    act(() => {
      useShortcutPulseStore
        .getState()
        .triggerPulse({ key: "s", keyLabel: "S", label: "Open source" });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      useShortcutPulseStore
        .getState()
        .triggerPulse({ key: "s", keyLabel: "S", label: "Open source" });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // The first trigger would have expired at 450ms; the restart keeps it.
    expect(screen.getByTestId("shortcut-pulse")).toBeInTheDocument();
  });
});
