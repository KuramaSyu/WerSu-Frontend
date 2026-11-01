// @vitest-environment jsdom

import "../test/setup";

import { act, render, screen } from "@testing-library/react";
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

  it("renders the pulse and clears it after the sweep", () => {
    render(<ShortcutPulse />);

    act(() => {
      useShortcutPulseStore
        .getState()
        .triggerPulse({ key: "i", keyLabel: "I", label: "Enter insert mode" });
    });

    expect(screen.getByTestId("shortcut-pulse")).toBeInTheDocument();
    expect(screen.getByText("Enter insert mode")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SHORTCUT_PULSE_DURATION_MS);
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
